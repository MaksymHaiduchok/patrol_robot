import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OperatorGateway } from '../operator/operator.gateway.js';
import type {
  EventRecord,
  EventsPage,
  ReviewEventRequest,
  SystemMode,
  VisionEvent,
} from '../protocol/protocol.js';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly systemMode: SystemMode = 'PATROL';

  constructor(
    private readonly supabase: SupabaseService,
    private readonly operatorGateway: OperatorGateway,
  ) {}

  async create(event: VisionEvent): Promise<EventRecord> {
    const receivedAt = Date.now();
    this.logger.log(
      `received ${event.type} confidence=${event.confidence ?? '-'} vision→api ${receivedAt - event.ts} ms`,
    );

    const { data, error } = await this.supabase.client
      .from('events')
      .insert({
        type: event.type,
        confidence: event.confidence,
        person_id: event.person_id,
        mode: this.systemMode,
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
    return data;
  }

  async review(id: string, request: ReviewEventRequest): Promise<EventRecord> {
    const { data, error } = await this.supabase.client
      .from('events')
      .update({
        review_status: request.status,
        person_id: request.person_id,
        reviewed_at: new Date().toISOString(),
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

    this.logger.log(`reviewed event ${id} as ${request.status}`);
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
