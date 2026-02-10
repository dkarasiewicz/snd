import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export const SND_HOME = process.env.SND_HOME ?? path.join(os.homedir(), '.snd');
export const SND_CONFIG_PATH = process.env.SND_CONFIG_PATH ?? path.join(SND_HOME, 'config.yaml');
export const SND_DB_PATH = process.env.SND_DB_PATH ?? path.join(SND_HOME, 'snd.db');
export const SND_SECRET_STORE_PATH = path.join(SND_HOME, 'secrets.enc.json');
export const SND_MASTER_KEY_PATH = path.join(SND_HOME, 'master.key');

export function ensureSndHome(): void {
  if (!fs.existsSync(SND_HOME)) {
    fs.mkdirSync(SND_HOME, { recursive: true, mode: 0o700 });
    return;
  }

  fs.chmodSync(SND_HOME, 0o700);
}
