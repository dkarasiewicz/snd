import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export const SND_HOME = process.env.SND_HOME ?? path.join(os.homedir(), '.snd');
export const SND_CONFIG_PATH = process.env.SND_CONFIG_PATH ?? path.join(SND_HOME, 'config.yaml');
export const SND_DB_PATH = process.env.SND_DB_PATH ?? path.join(SND_HOME, 'snd.db');
export const SND_SECRET_STORE_PATH = path.join(SND_HOME, 'secrets.enc.json');
export const SND_MASTER_KEY_PATH = path.join(SND_HOME, 'master.key');
export const SND_LOG_DIR = path.join(SND_HOME, 'log');
export const SND_PLUGINS_DIR = path.join(SND_HOME, 'plugins');
export const SND_PROJECT_PLUGINS_DIR = path.join(process.cwd(), '.snd', 'plugins');
export const SND_LAUNCHD_LABEL = 'io.snd.agent';
export const SND_LAUNCHD_PLIST_PATH = path.join(
  os.homedir(),
  'Library',
  'LaunchAgents',
  `${SND_LAUNCHD_LABEL}.plist`,
);

export function ensureSndHome(): void {
  if (!fs.existsSync(SND_HOME)) {
    fs.mkdirSync(SND_HOME, { recursive: true, mode: 0o700 });
  } else {
    fs.chmodSync(SND_HOME, 0o700);
  }

  ensureSndRuntimeDirs();
}

export function ensureSndRuntimeDirs(): void {
  fs.mkdirSync(SND_LOG_DIR, { recursive: true, mode: 0o700 });
  fs.mkdirSync(SND_PLUGINS_DIR, { recursive: true, mode: 0o700 });
}
