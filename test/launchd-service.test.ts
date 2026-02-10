import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = {
  SND_HOME: process.env.SND_HOME,
  SND_CONFIG_PATH: process.env.SND_CONFIG_PATH,
  SND_DB_PATH: process.env.SND_DB_PATH,
};

let tempDir = '';
const originalArgv = [...process.argv];

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
  process.argv = [...originalArgv];
  vi.resetModules();

  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  tempDir = '';
});

describe('LaunchdService', () => {
  it('builds launchd program args with plain UI, interval, and account', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snd-launchd-'));
    process.env.SND_HOME = path.join(tempDir, '.snd-home');
    process.env.SND_CONFIG_PATH = path.join(process.env.SND_HOME, 'config.yaml');
    process.env.SND_DB_PATH = path.join(process.env.SND_HOME, 'snd.db');

    const fakeEntry = path.join(tempDir, 'snd-entry.js');
    fs.writeFileSync(fakeEntry, 'console.log("snd")', 'utf8');
    process.argv = [process.execPath, fakeEntry];

    vi.resetModules();
    const { LaunchdService } = await import('../src/daemon/launchd.service.js');

    const service = new LaunchdService();
    const spec = service.buildSpec({ intervalSeconds: 180, accountId: 'main' });

    expect(spec.programArguments).toEqual([
      process.execPath,
      path.resolve(fakeEntry),
      'run',
      '--ui',
      'plain',
      '--interval',
      '180',
      '--account',
      'main',
    ]);

    const plist = service.buildPlistXml(spec);
    expect(plist).toContain('<string>io.snd.agent</string>');
    expect(plist).toContain('<key>ProgramArguments</key>');
    expect(plist).toContain('<string>--ui</string>');
    expect(plist).toContain('<string>plain</string>');
  });
});
