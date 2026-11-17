import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClaudeService } from '../claude/claude.service.js';
import { DecisionService } from '../decision/decision.service.js';
import { OperatorGateway } from '../operator/operator.gateway.js';
import type {
  EventRecord,
  EventsPage,
  EventType,
  ReviewEventRequest,
  VisionEvent,
} from '../protocol/protocol.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { VisionService } from '../vision/vision.service.js';

const SNAPSHOTS_BUCKET = 'snapshots';
const SNAPSHOT_URL_TTL_SECONDS = 60;
const SNAPSHOT_EVENTS: EventType[] = ['person_detected', 'stranger_detected'];

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly operatorGateway: OperatorGateway,
    private readonly decision: DecisionService,
    private readonly vision: VisionService,
    private readonly claude: ClaudeService,
  ) {}

  async create(event: VisionEvent): Promise<EventRecord> {
    const receivedAt = Date.now();
    this.logger.log(
      `received ${event.type} confidence=${event.confidence ?? '-'} vision→api ${receivedAt - event.ts} ms`,
    );
    this.decision.onVisionEvent(event, receivedAt);

    const { data, error } = await this.supabase.client
      .from('events')
      .insert({
        type: event.type,
        confidence: event.confidence,
        person_id: event.person_id,
        mode: this.decision.systemMode,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`failed to save ${event.type}: ${error.message}`);
      throw new InternalServerErrorException('Failed to save event');
    }

    this.logger.log(
      `saved ${data.type} id=${data.id} in ${Date.now() - receivedAt} ms`,
    );
    this.operatorGateway.broadcast({ type: 'event_created', event: data });
    if (SNAPSHOT_EVENTS.includes(data.type)) {
      void this.attachSnapshot(data, event.ts);
    }
    return data;
  }

  async snapshotUrl(id: string): Promise<string> {
    const { data, error } = await this.supabase.client
      .from('events')
      .select('snapshot_path')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException('Failed to load event');
    }
    if (!data?.snapshot_path) {
      throw new NotFoundException(`Event ${id} has no snapshot`);
    }
    const signed = await this.supabase.client.storage
      .from(SNAPSHOTS_BUCKET)
      .createSignedUrl(data.snapshot_path, SNAPSHOT_URL_TTL_SECONDS);
    if (signed.error) {
      this.logger.error(
        `failed to sign snapshot ${id}: ${signed.error.message}`,
      );
      throw new InternalServerErrorException('Failed to load snapshot');
    }
    return signed.data.signedUrl;
  }

  private async attachSnapshot(record: EventRecord, ts: number): Promise<void> {
    try {
      const jpeg = await this.vision.snapshot(ts);
      if (!jpeg) {
        return;
      }
      const path = `${record.id}.jpg`;
      const upload = await this.supabase.client.storage
        .from(SNAPSHOTS_BUCKET)
        .upload(path, jpeg, { contentType: 'image/jpeg', upsert: true });
      if (upload.error) {
        this.logger.error(
          `failed to upload snapshot ${record.id}: ${upload.error.message}`,
        );
        return;
      }
      await this.updateEvent(record.id, { snapshot_path: path });
      this.logger.log(`snapshot saved for ${record.id}`);

      if (record.type === 'stranger_detected' && this.claude.enabled) {
        const started = Date.now();
        const description = await this.claude.describe(jpeg);
        this.logger.log(
          `claude description for ${record.id} in ${Date.now() - started} ms`,
        );
        if (description) {
          await this.updateEvent(record.id, { description });
        }
      }
    } catch (error) {
      this.logger.error(
        `snapshot/description for ${record.id} failed: ${String(error)}`,
      );
    }
  }

  private async updateEvent(
    id: string,
    fields: { snapshot_path?: string; description?: string },
  ): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('events')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      this.logger.error(`failed to update event ${id}: ${error.message}`);
      return;
    }
    this.operatorGateway.broadcast({ type: 'event_updated', event: data });
  }

  async review(id: string, request: ReviewEventRequest): Promise<EventRecord> {
    const { data, error } = await this.supabase.client
      .from('events')
      .update({
        review_status: request.status,
        person_id: request.person_id,
        reviewed_at: request.status ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      this.logger.error(`failed to review event ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to review event');
    }
    if (!data) {
      throw new NotFoundException(`Event ${id} not found`);
    }

    this.logger.log(
      `reviewed event ${id} as ${request.status ?? 'unreviewed'}`,
    );
    this.operatorGateway.broadcast({ type: 'event_updated', event: data });
    return data;
  }

  async findPage(limit: number, offset: number): Promise<EventsPage> {
    const { data, error, count } = await this.supabase.client
      .from('events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(`failed to load events: ${error.message}`);
      throw new InternalServerErrorException('Failed to load events');
    }

    return { items: data, total: count ?? 0 };
  }
}
