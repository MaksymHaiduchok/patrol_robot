import { Module } from '@nestjs/common';
import { OperatorModule } from '../operator/operator.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [OperatorModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
