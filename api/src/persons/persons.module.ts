import { Module } from '@nestjs/common';
import { VisionModule } from '../vision/vision.module.js';
import { PersonsController } from './persons.controller.js';
import { PersonsService } from './persons.service.js';

@Module({
  imports: [VisionModule],
  controllers: [PersonsController],
  providers: [PersonsService],
})
export class PersonsModule {}
