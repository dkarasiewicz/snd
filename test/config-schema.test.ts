import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sndConfigSchema } from '../src/config/schema.js';

describe('sndConfigSchema null compatibility', () => {
  it('accepts defaultAccountId: null and normalizes it', () => {
    const config = sndConfigSchema.parse({
      defaultAccountId: null,
    });

    expect(config.defaultAccountId).toBeUndefined();
  });

  it('accepts llm.baseUrl: null and normalizes it', () => {
    const config = sndConfigSchema.parse({
      llm: {
        baseUrl: null,
      },
    });

    expect(config.llm.baseUrl).toBeUndefined();
  });

  it('accepts account oauth: null and normalizes it', () => {
    const config = sndConfigSchema.parse({
      accounts: [
        {
          id: 'main',
          email: 'user@example.com',
          provider: 'gmail',
          imap: {
            host: 'imap.gmail.com',
            port: 993,
            secure: true,
            username: 'user@example.com',
            auth: 'oauth2',
          },
          oauth: null,
        },
      ],
    });

    expect(config.accounts[0]?.oauth).toBeUndefined();
  });

  it('still rejects invalid non-null llm.baseUrl', () => {
    expect(() =>
      sndConfigSchema.parse({
        llm: {
          baseUrl: 'invalid-url',
        },
      }),
    ).toThrow();
  });

  it('maps legacy llm.useDeepAgents to agent.enabled when agent block is missing', () => {
    const config = sndConfigSchema.parse({
      llm: {
        useDeepAgents: false,
      },
    });

    expect(config.agent.enabled).toBe(false);
    expect(config.llm.useDeepAgents).toBe(false);
  });

  it('prefers explicit agent.enabled over legacy llm.useDeepAgents', () => {
    const config = sndConfigSchema.parse({
      llm: {
        useDeepAgents: false,
      },
      agent: {
        enabled: true,
      },
    });

    expect(config.agent.enabled).toBe(true);
    expect(config.llm.useDeepAgents).toBe(true);
  });
});

describe('ConfigService defaults and legacy null config', () => {
  const originalEnv = {
    SND_HOME: process.env.SND_HOME,
    SND_CONFIG_PATH: process.env.SND_CONFIG_PATH,
    SND_DB_PATH: process.env.SND_DB_PATH,
  };

  let tempDir = '';

  function restoreEnv(key: 'SND_HOME' | 'SND_CONFIG_PATH' | 'SND_DB_PATH', value: string | undefined): void {
    if (value === undefined) {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  }

  afterEach(() => {
    restoreEnv('SND_HOME', originalEnv.SND_HOME);
    restoreEnv('SND_CONFIG_PATH', originalEnv.SND_CONFIG_PATH);
    restoreEnv('SND_DB_PATH', originalEnv.SND_DB_PATH);
    vi.resetModules();

    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    tempDir = '';
  });

  it('creates a default config that loads and has undefined defaultAccountId', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snd-config-'));
    process.env.SND_HOME = tempDir;
    process.env.SND_CONFIG_PATH = path.join(tempDir, 'config.yaml');
    process.env.SND_DB_PATH = path.join(tempDir, 'snd.db');
    const configPath = process.env.SND_CONFIG_PATH;
    if (!configPath) {
      throw new Error('missing SND_CONFIG_PATH');
    }
    vi.resetModules();

    const { ConfigService } = await import('../src/config/config.service.js');
    const service = new ConfigService();
    service.ensureConfigExists();

    const raw = fs.readFileSync(configPath, 'utf8');
    expect(raw).not.toContain('defaultAccountId:');

    const config = service.load();
    expect(config.defaultAccountId).toBeUndefined();
  });

  it('loads legacy config with defaultAccountId: null', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snd-config-'));
    process.env.SND_HOME = tempDir;
    process.env.SND_CONFIG_PATH = path.join(tempDir, 'config.yaml');
    process.env.SND_DB_PATH = path.join(tempDir, 'snd.db');
    const configPath = process.env.SND_CONFIG_PATH;
    if (!configPath) {
      throw new Error('missing SND_CONFIG_PATH');
    }
    vi.resetModules();

    fs.writeFileSync(
      configPath,
      `version: 1
defaultAccountId:
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
`,
      'utf8',
    );

    const { ConfigService } = await import('../src/config/config.service.js');
    const service = new ConfigService();
    const config = service.load();

    expect(config.defaultAccountId).toBeUndefined();
  });
});
