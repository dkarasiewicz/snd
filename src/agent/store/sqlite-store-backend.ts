import { StoreService } from './store.service.js';

type StoreSearchResult = {
  key: string;
  value: unknown;
  updatedAt: number;
};

export class SqliteStoreBackend {
  constructor(
    private readonly storeService: StoreService,
    private readonly namespace: string,
  ) {}

  async get(key: string): Promise<unknown | null> {
    const entry = this.storeService.get(this.namespace, key);
    if (!entry) {
      return null;
    }

    return parseValue(entry.value);
  }

  async put(key: string, value: unknown): Promise<void> {
    this.storeService.put(this.namespace, key, stringifyValue(value));
  }

  async delete(key: string): Promise<void> {
    this.storeService.delete(this.namespace, key);
  }

  async search(prefix?: string): Promise<StoreSearchResult[]> {
    const entries = this.storeService.list(this.namespace, prefix);
    return entries.map((entry) => ({
      key: entry.key,
      value: parseValue(entry.value),
      updatedAt: entry.updatedAt,
    }));
  }
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

function parseValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
