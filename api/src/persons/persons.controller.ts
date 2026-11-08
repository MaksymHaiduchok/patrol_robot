import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type {
  AddPhotosResult,
  PersonEmbedding,
  PersonRecord,
  PersonSummary,
} from '../protocol/protocol.js';
import { PersonsService, type UploadedPhoto } from './persons.service.js';
import { parseCreatePersonRequest } from './persons.validation.js';

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Post()
  create(@Body() body: unknown): Promise<PersonRecord> {
    return this.personsService.create(parseCreatePersonRequest(body));
  }

  @Get()
  findAll(): Promise<PersonSummary[]> {
    return this.personsService.findAll();
  }

  @Get('embeddings')
  findEmbeddings(): Promise<PersonEmbedding[]> {
    return this.personsService.findEmbeddings();
  }

  @Post(':id/photos')
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS, {
      limits: { fileSize: MAX_PHOTO_BYTES },
    }),
  )
  addPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() photos: UploadedPhoto[] | undefined,
  ): Promise<AddPhotosResult> {
    if (!photos?.length) {
      throw new BadRequestException('At least one photo is required');
    }
    if (photos.some((photo) => !photo.mimetype.startsWith('image/'))) {
      throw new BadRequestException('Only image files are allowed');
    }
    return this.personsService.addPhotos(id, photos);
  }

  @Post(':id/capture')
  capture(@Param('id', ParseUUIDPipe) id: string): Promise<AddPhotosResult> {
    return this.personsService.captureFromCamera(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.personsService.remove(id);
  }
}
