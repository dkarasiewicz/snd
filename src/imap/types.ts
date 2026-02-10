export type ParsedAddress = {
  address: string;
  name: string;
};

export type ImapMessage = {
  uid: number;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  subject: string;
  from: ParsedAddress;
  to: ParsedAddress[];
  cc: ParsedAddress[];
  sentAt: number;
  text: string;
  headers: string;
};
