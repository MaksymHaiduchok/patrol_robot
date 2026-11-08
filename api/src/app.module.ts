import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { EventsModule } from './events/events.module.js';
import { OperatorModule } from './operator/operator.module.js';
import { PersonsModule } from './persons/persons.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';

@Module({
  imports: [SupabaseModule, OperatorModule, EventsModule, PersonsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
