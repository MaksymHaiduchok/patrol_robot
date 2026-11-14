import { Module } from '@nestjs/common';
import { RobotModule } from '../robot/robot.module.js';
import { OperatorGateway } from './operator.gateway.js';

@Module({
  imports: [RobotModule],
  providers: [OperatorGateway],
  exports: [OperatorGateway],
})
export class OperatorModule {}
