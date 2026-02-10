import { describe, expect, it } from 'vitest';
import { SqliteStoreBackend } from '../src/agent/store/sqlite-store-backend.js';

type FakeEntry = {
  namespace: string;
  key: string;
  value: string;
  updatedAt: number;
};

class FakeStoreService {
  private readonly store = new Map<string, FakeEntry>();

  put(namespace: string, key: string, value: string): FakeEntry {
    const entry = {
      namespace,
      key,
      value,
      updatedAt: Date.now(),
    };

    this.store.set(`${namespace}:${key}`, entry);
    return entry;
  }

  get(namespace: string, key: string): FakeEntry | null {
    return this.store.get(`${namespace}:${key}`) ?? null;
  }

  list(namespace: string, keyPrefix?: string): FakeEntry[] {
    const entries = Array.from(this.store.values()).filter((entry) => entry.namespace === namespace);
    if (!keyPrefix) {
      return entries;
    }

    return entries.filter((entry) => entry.key.startsWith(keyPrefix));
  }

  delete(namespace: string, key: string): boolean {
    return this.store.delete(`${namespace}:${key}`);
  }
}

describe('SqliteStoreBackend', () => {
  it('supports put/get/search/delete and namespace isolation', async () => {
    const store = new FakeStoreService();

    const backendA = new SqliteStoreBackend(store as never, 'draft:main:local');
    const backendB = new SqliteStoreBackend(store as never, 'draft:other:local');

    await backendA.put('memory:style', { tone: 'brief' });
    await backendA.put('memory:context', 'foo');
    await backendB.put('memory:style', { tone: 'long' });

    expect(await backendA.get('memory:style')).toEqual({ tone: 'brief' });
    expect(await backendB.get('memory:style')).toEqual({ tone: 'long' });

    const search = await backendA.search('memory:');
    expect(search.map((entry) => entry.key)).toContain('memory:style');
    expect(search.map((entry) => entry.key)).toContain('memory:context');

    await backendA.delete('memory:context');
    expect(await backendA.get('memory:context')).toBeNull();

    const backendA2 = new SqliteStoreBackend(store as never, 'draft:main:local');
    expect(await backendA2.get('memory:style')).toEqual({ tone: 'brief' });
  });
});
