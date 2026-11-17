import { Module } from '@nestjs/common';
import { DecisionModule } from '../decision/decision.module.js';
import { RobotModule } from '../robot/robot.module.js';
import { OperatorGateway } from './operator.gateway.js';

@Module({
  imports: [RobotModule, DecisionModule],
  providers: [OperatorGateway],
  exports: [OperatorGateway],
})
export class OperatorModule {}
