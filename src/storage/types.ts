export type SyncState = {
  accountId: string;
  lastUid: number;
  lastSyncAt: number;
};

export type ThreadRecord = {
  id: string;
  accountId: string;
  threadKey: string;
  subject: string;
  participants: string[];
  lastMessageAt: number;
  lastSender: string;
  needsReply: boolean;
  summary: string | null;
  updatedAt: number;
};

export type MessageRecord = {
  id: string;
  accountId: string;
  threadId: string;
  uid: number;
  messageId: string;
  inReplyTo: string | null;
  subject: string;
  fromAddress: string;
  fromName: string;
  toAddresses: string[];
  ccAddresses: string[];
  bodyText: string;
  sentAt: number;
  rawHeaders: string;
};

export type DraftRecord = {
  id: string;
  threadId: string;
  content: string;
  status: 'drafted' | 'edited' | 'skipped';
  updatedAt: number;
  model: string;
};

export type RuleRecord = {
  id: string;
  kind: 'ignore_sender' | 'ignore_domain' | 'style';
  scope: string;
  pattern: string;
  value: string;
  enabled: boolean;
};

export type MemoryNote = {
  id: string;
  scope: 'user' | 'thread' | 'contact';
  key: string;
  value: string;
  updatedAt: number;
};

export type AgentStoreEntry = {
  id: string;
  namespace: string;
  key: string;
  value: string;
  updatedAt: number;
};
