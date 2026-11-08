import { Body, Controller, Get, Post } from '@nestjs/common';
import type { PersonRecord } from '../protocol/protocol.js';
import { PersonsService } from './persons.service.js';
import { parseCreatePersonRequest } from './persons.validation.js';

@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Post()
  create(@Body() body: unknown): Promise<PersonRecord> {
    return this.personsService.create(parseCreatePersonRequest(body));
  }

  @Get()
  findAll(): Promise<PersonRecord[]> {
    return this.personsService.findAll();
  }
}
