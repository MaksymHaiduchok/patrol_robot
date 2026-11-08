import { randomUUID } from 'node:crypto';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  AddPhotosResult,
  CreatePersonRequest,
  PersonEmbedding,
  PersonRecord,
  PersonSummary,
} from '../protocol/protocol.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { FaceRejectedError, VisionService } from '../vision/vision.service.js';

const FACES_BUCKET = 'faces';

export type UploadedPhoto = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Injectable()
export class PersonsService {
  private readonly logger = new Logger(PersonsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly vision: VisionService,
  ) {}

  async create(request: CreatePersonRequest): Promise<PersonRecord> {
    const { data, error } = await this.supabase.client
      .from('persons')
      .insert({ name: request.name })
      .select()
      .single();

    if (error) {
      this.logger.error(`failed to create person: ${error.message}`);
      throw new InternalServerErrorException('Failed to create person');
    }

    this.logger.log(`created person ${data.id}`);
    return data;
  }

  async findAll(): Promise<PersonSummary[]> {
    const [persons, embeddings] = await Promise.all([
      this.supabase.client.from('persons').select('*').order('name'),
      this.supabase.client.from('face_embeddings').select('person_id'),
    ]);

    if (persons.error || embeddings.error) {
      this.logger.error(
        `failed to load persons: ${persons.error?.message ?? embeddings.error?.message}`,
      );
      throw new InternalServerErrorException('Failed to load persons');
    }

    const counts = new Map<string, number>();
    for (const { person_id } of embeddings.data) {
      counts.set(person_id, (counts.get(person_id) ?? 0) + 1);
    }

    return persons.data.map((person) => ({
      ...person,
      photo_count: counts.get(person.id) ?? 0,
    }));
  }

  async findEmbeddings(): Promise<PersonEmbedding[]> {
    const [persons, embeddings] = await Promise.all([
      this.supabase.client.from('persons').select('id, name'),
      this.supabase.client
        .from('face_embeddings')
        .select('person_id, embedding'),
    ]);

    if (persons.error || embeddings.error) {
      this.logger.error(
        `failed to load embeddings: ${persons.error?.message ?? embeddings.error?.message}`,
      );
      throw new InternalServerErrorException('Failed to load embeddings');
    }

    const names = new Map(
      persons.data.map((person) => [person.id, person.name]),
    );

    return embeddings.data.map((row) => ({
      person_id: row.person_id,
      name: names.get(row.person_id) ?? '',
      embedding: JSON.parse(row.embedding) as number[],
    }));
  }

  async addPhotos(
    personId: string,
    photos: UploadedPhoto[],
  ): Promise<AddPhotosResult> {
    await this.ensureExists(personId);
    const result: AddPhotosResult = { added: 0, failed: [] };

    for (const photo of photos) {
      try {
        const embedding = await this.vision.embed(photo.buffer);
        await this.saveFace(personId, embedding, photo.buffer, photo.mimetype);
        result.added += 1;
      } catch (error) {
        if (!(error instanceof FaceRejectedError)) throw error;
        result.failed.push({ file: photo.originalname, reason: error.reason });
      }
    }

    this.logger.log(
      `person ${personId}: added ${result.added} photos, rejected ${result.failed.length}`,
    );
    if (result.added > 0) {
      await this.vision.reload();
    }
    return result;
  }

  async captureFromCamera(personId: string): Promise<AddPhotosResult> {
    await this.ensureExists(personId);
    const captured = await this.vision.capture();
    await this.saveFace(
      personId,
      captured.embedding,
      Buffer.from(captured.image, 'base64'),
      'image/jpeg',
    );
    this.logger.log(`person ${personId}: captured face from camera`);
    await this.vision.reload();
    return { added: 1, failed: [] };
  }

  async remove(personId: string): Promise<void> {
    await this.ensureExists(personId);
    const storage = this.supabase.client.storage.from(FACES_BUCKET);

    const { data: files } = await storage.list(personId);
    if (files?.length) {
      await storage.remove(files.map((file) => `${personId}/${file.name}`));
    }

    const { error } = await this.supabase.client
      .from('persons')
      .delete()
      .eq('id', personId);
    if (error) {
      this.logger.error(
        `failed to delete person ${personId}: ${error.message}`,
      );
      throw new InternalServerErrorException('Failed to delete person');
    }

    this.logger.log(`deleted person ${personId}`);
    await this.vision.reload();
  }

  private async ensureExists(personId: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('persons')
      .select('id')
      .eq('id', personId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException('Failed to load person');
    }
    if (!data) {
      throw new NotFoundException(`Person ${personId} not found`);
    }
  }

  private async saveFace(
    personId: string,
    embedding: number[],
    image: Buffer,
    contentType: string,
  ): Promise<void> {
    const extension = contentType === 'image/png' ? 'png' : 'jpg';
    const photoPath = `${personId}/${randomUUID()}.${extension}`;
    const upload = await this.supabase.client.storage
      .from(FACES_BUCKET)
      .upload(photoPath, image, { contentType });
    if (upload.error) {
      this.logger.error(`failed to upload face photo: ${upload.error.message}`);
      throw new InternalServerErrorException('Failed to upload photo');
    }

    const { error } = await this.supabase.client
      .from('face_embeddings')
      .insert({
        person_id: personId,
        embedding: JSON.stringify(embedding),
        photo_path: photoPath,
      });
    if (error) {
      this.logger.error(`failed to save embedding: ${error.message}`);
      throw new InternalServerErrorException('Failed to save embedding');
    }
  }
}
