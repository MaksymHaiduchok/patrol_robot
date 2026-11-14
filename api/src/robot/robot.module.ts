import { Module } from '@nestjs/common';
import { RobotGateway } from './robot.gateway.js';

@Module({
  providers: [RobotGateway],
  exports: [RobotGateway],
})
export class RobotModule {}
