import { Module } from '@nestjs/common';
import { DecisionModule } from '../decision/decision.module.js';
import { RobotModule } from '../robot/robot.module.js';
import { VisionModule } from '../vision/vision.module.js';
import { NavigationService } from './navigation.service.js';

@Module({
  imports: [RobotModule, DecisionModule, VisionModule],
  providers: [NavigationService],
  exports: [NavigationService],
})
export class NavigationModule {}
