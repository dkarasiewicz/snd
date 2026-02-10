import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Injectable } from '@nestjs/common';
import { ensureSndHome, SND_MASTER_KEY_PATH, SND_SECRET_STORE_PATH } from './paths.js';

type SecretMap = Record<string, { iv: string; authTag: string; ciphertext: string }>;

@Injectable()
export class CredentialStoreService {
  private readonly keychainService = 'snd-cli';

  setSecret(key: string, value: string): void {
    if (this.setInMacKeychain(key, value)) {
      return;
    }

    this.setEncryptedFallback(key, value);
  }

  getSecret(key: string): string | null {
    const keychainValue = this.getFromMacKeychain(key);
    if (keychainValue) {
      return keychainValue;
    }

    return this.getEncryptedFallback(key);
  }

  private setInMacKeychain(account: string, value: string): boolean {
    const result = spawnSync(
      'security',
      ['add-generic-password', '-U', '-s', this.keychainService, '-a', account, '-w', value],
      { stdio: 'ignore' },
    );

    return result.status === 0;
  }

  private getFromMacKeychain(account: string): string | null {
    const result = spawnSync('security', ['find-generic-password', '-s', this.keychainService, '-a', account, '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    if (result.status !== 0) {
      return null;
    }

    return result.stdout.trim();
  }

  private setEncryptedFallback(key: string, value: string): void {
    ensureSndHome();
    const masterKey = this.getOrCreateMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);

    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const map = this.readSecretMap();
    map[key] = {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };

    fs.writeFileSync(SND_SECRET_STORE_PATH, JSON.stringify(map, null, 2), { mode: 0o600 });
  }

  private getEncryptedFallback(key: string): string | null {
    if (!fs.existsSync(SND_SECRET_STORE_PATH)) {
      return null;
    }

    const map = this.readSecretMap();
    const entry = map[key];
    if (!entry) {
      return null;
    }

    const masterKey = this.getOrCreateMasterKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, Buffer.from(entry.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(entry.authTag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(entry.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');

    return plaintext;
  }

  private getOrCreateMasterKey(): Buffer {
    ensureSndHome();

    if (!fs.existsSync(SND_MASTER_KEY_PATH)) {
      const key = crypto.randomBytes(32);
      fs.writeFileSync(SND_MASTER_KEY_PATH, key.toString('base64'), { mode: 0o600 });
      return key;
    }

    const raw = fs.readFileSync(SND_MASTER_KEY_PATH, 'utf8').trim();
    return Buffer.from(raw, 'base64');
  }

  private readSecretMap(): SecretMap {
    if (!fs.existsSync(SND_SECRET_STORE_PATH)) {
      return {};
    }

    try {
      const raw = fs.readFileSync(SND_SECRET_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as SecretMap;
      return parsed;
    } catch {
      return {};
    }
  }
}
