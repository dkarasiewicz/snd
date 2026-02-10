import fs from 'node:fs';
import YAML from 'yaml';
import { Injectable } from '@nestjs/common';
import { ensureSndHome, SND_CONFIG_PATH } from '../core/paths.js';
import { SndConfig, sndConfigSchema } from './schema.js';

const DEFAULT_CONFIG_TEXT = `version: 1
poll:
  intervalSeconds: 300
llm:
  provider: openai-compatible
  model: gpt-4o-mini
  apiKeySecretKey: llm:default
  useDeepAgents: true
rules:
  ignoreSenders: []
  ignoreDomains: []
  globalVibe: brief, technical, direct
  styles: []
accounts: []
`;

@Injectable()
export class ConfigService {
  private cache: SndConfig | null = null;

  ensureConfigExists(force = false): void {
    ensureSndHome();

    if (fs.existsSync(SND_CONFIG_PATH) && !force) {
      return;
    }

    fs.writeFileSync(SND_CONFIG_PATH, DEFAULT_CONFIG_TEXT, { mode: 0o600 });
  }

  load(): SndConfig {
    if (this.cache) {
      return this.cache;
    }

    this.ensureConfigExists();
    const raw = fs.readFileSync(SND_CONFIG_PATH, 'utf8');
    const parsed = YAML.parse(raw);
    const config = sndConfigSchema.parse(parsed ?? {});
    this.cache = config;

    return config;
  }

  save(config: SndConfig): void {
    const normalized = sndConfigSchema.parse(config);
    ensureSndHome();

    fs.writeFileSync(SND_CONFIG_PATH, YAML.stringify(normalized), { mode: 0o600 });
    this.cache = normalized;
  }

  update(mutator: (config: SndConfig) => SndConfig): SndConfig {
    const next = mutator(this.load());
    this.save(next);
    return next;
  }
}
