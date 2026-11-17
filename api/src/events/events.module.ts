import { Module } from '@nestjs/common';
import { ClaudeModule } from '../claude/claude.module.js';
import { DecisionModule } from '../decision/decision.module.js';
import { OperatorModule } from '../operator/operator.module.js';
import { VisionModule } from '../vision/vision.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [OperatorModule, DecisionModule, VisionModule, ClaudeModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
