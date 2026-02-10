import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../storage/database.service.js';

@Injectable()
export class MemoryService {
  constructor(private readonly databaseService: DatabaseService) {}

  getUserNotes(): string[] {
    return this.databaseService.listMemory('user').map((note) => note.value);
  }

  getThreadNotes(threadId: string): string[] {
    return this.databaseService
      .listMemory('thread')
      .filter((note) => note.key.startsWith(`${threadId}:`))
      .map((note) => note.value);
  }

  rememberThreadContext(threadId: string, summary: string): void {
    this.databaseService.upsertMemoryNote({
      scope: 'thread',
      key: `${threadId}:context`,
      value: summary,
    });
  }

  rememberDraftPattern(threadId: string, summary: string): void {
    this.databaseService.upsertMemoryNote({
      scope: 'thread',
      key: `${threadId}:draft`,
      value: summary,
    });
  }

  rememberUserPreference(key: string, value: string): void {
    this.databaseService.upsertMemoryNote({
      scope: 'user',
      key,
      value,
    });
  }

  learnFromEdit(threadId: string, draft: string): void {
    const compact = draft.replace(/\s+/g, ' ').trim().slice(0, 320);
    if (!compact) {
      return;
    }

    this.databaseService.upsertMemoryNote({
      scope: 'thread',
      key: `${threadId}:edit`,
      value: `Edited draft tone sample: ${compact}`,
    });

    const styleHint = this.extractStyleHint(compact);
    if (!styleHint) {
      return;
    }

    this.rememberUserPreference('style:autolearned', styleHint);
  }

  private extractStyleHint(text: string): string | null {
    const lower = text.toLowerCase();
    const markers: string[] = [];

    if (text.length < 220) {
      markers.push('short-form');
    }
    if (lower.includes('thanks')) {
      markers.push('polite-close');
    }
    if (text.includes('- ') || text.includes('\n1.')) {
      markers.push('structured-list');
    }
    if (lower.includes('let me know')) {
      markers.push('explicit-follow-up');
    }

    if (markers.length === 0) {
      return null;
    }

    return `Autolearned style markers: ${markers.join(', ')}`;
  }
}
