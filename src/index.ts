#!/usr/bin/env node
import 'dotenv/config';
import { CommandFactory } from 'nest-commander';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  try {
    await CommandFactory.run(AppModule, {
      logger: ['error', 'warn'],
    });
  } catch (error) {
    process.stderr.write(`snd error: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

void bootstrap();
