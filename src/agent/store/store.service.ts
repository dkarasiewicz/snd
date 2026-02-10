import { Injectable } from '@nestjs/common';
import { DraftRequest } from '../types.js';
import { AgentStoreEntry } from '../../storage/types.js';
import { DatabaseService } from '../../storage/database.service.js';

@Injectable()
export class StoreService {
  constructor(private readonly databaseService: DatabaseService) {}

  makeNamespace(parts: { accountId?: string; userId?: string; scope?: string }): string {
    const accountId = parts.accountId ?? 'default';
    const userId = parts.userId ?? 'local';
    const scope = parts.scope ?? 'agent';
    return `${scope}:${accountId}:${userId}`;
  }

  namespaceForDraftRequest(request: DraftRequest): string {
    const accountId = request.messages[0]?.accountId;
    return this.makeNamespace({ accountId, scope: 'draft' });
  }

  put(namespace: string, key: string, value: string): AgentStoreEntry {
    return this.databaseService.upsertAgentStoreEntry({
      namespace,
      key,
      value,
    });
  }

  get(namespace: string, key: string): AgentStoreEntry | null {
    return this.databaseService.getAgentStoreEntry(namespace, key);
  }

  list(namespace: string, keyPrefix?: string): AgentStoreEntry[] {
    return this.databaseService.listAgentStoreEntries(namespace, keyPrefix);
  }

  delete(namespace: string, key: string): boolean {
    return this.databaseService.deleteAgentStoreEntry(namespace, key);
  }
}
