import { Module } from '@nestjs/common';
import { RobotModule } from '../robot/robot.module.js';
import { DecisionService } from './decision.service.js';

@Module({
  imports: [RobotModule],
  providers: [DecisionService],
  exports: [DecisionService],
})
export class DecisionModule {}
