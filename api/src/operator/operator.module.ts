import { Module } from '@nestjs/common';
import { DecisionModule } from '../decision/decision.module.js';
import { NavigationModule } from '../navigation/navigation.module.js';
import { RobotModule } from '../robot/robot.module.js';
import { OperatorGateway } from './operator.gateway.js';

@Module({
  imports: [RobotModule, DecisionModule, NavigationModule],
  providers: [OperatorGateway],
  exports: [OperatorGateway],
})
export class OperatorModule {}
