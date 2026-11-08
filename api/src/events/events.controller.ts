import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { EventRecord, EventsPage } from '../protocol/protocol.js';
import { EventsService } from './events.service.js';
import {
  parsePagination,
  parseReviewRequest,
  parseVisionEvent,
} from './events.validation.js';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@Body() body: unknown): Promise<EventRecord> {
    return this.eventsService.create(parseVisionEvent(body));
  }

  @Get()
  findPage(
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
  ): Promise<EventsPage> {
    const pagination = parsePagination(limit, offset);
    return this.eventsService.findPage(pagination.limit, pagination.offset);
  }

  @Patch(':id/review')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<EventRecord> {
    return this.eventsService.review(id, parseReviewRequest(body));
  }
}
