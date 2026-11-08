import { Module } from '@nestjs/common';
import { OperatorGateway } from './operator.gateway.js';

@Module({
  providers: [OperatorGateway],
  exports: [OperatorGateway],
})
export class OperatorModule {}
