import { MessageRecord } from '../storage/types.js';

export type DraftRequest = {
  threadId: string;
  model: string;
  vibe: string;
  userNotes: string[];
  threadNotes: string[];
  messages: MessageRecord[];
  instruction?: string;
};

export type DraftResult = {
  content: string;
  model: string;
  usedDeepAgents: boolean;
};
