import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type {
  CreatePersonRequest,
  PersonRecord,
} from '../protocol/protocol.js';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class PersonsService {
  private readonly logger = new Logger(PersonsService.name);

  constructor(private readonly supabase: SupabaseService) {}

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

  async findAll(): Promise<PersonRecord[]> {
    const { data, error } = await this.supabase.client
      .from('persons')
      .select('*')
      .order('name');

    if (error) {
      this.logger.error(`failed to load persons: ${error.message}`);
      throw new InternalServerErrorException('Failed to load persons');
    }

    return data;
  }
}
