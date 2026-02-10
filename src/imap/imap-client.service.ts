import { Injectable } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { SndAccountConfig } from '../config/schema.js';
import { CredentialStoreService } from '../core/credential-store.service.js';
import { GmailOauthService } from './gmail-oauth.service.js';
import { ImapMessage, ParsedAddress } from './types.js';

type OAuthSecret = {
  refreshToken: string;
};

export type FetchNewMessagesOptions = {
  bootstrapMessageWindow?: number;
};

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function toParsedAddress(input: { name?: string | null; address?: string | null }): ParsedAddress {
  return {
    name: input.name ? String(input.name).trim() : '',
    address: input.address ? normalizeAddress(String(input.address)) : '',
  };
}

@Injectable()
export class ImapClientService {
  constructor(
    private readonly credentialStore: CredentialStoreService,
    private readonly gmailOauthService: GmailOauthService,
  ) {}

  async fetchNewMessages(
    account: SndAccountConfig,
    lastUid: number,
    options?: FetchNewMessagesOptions,
  ): Promise<{ messages: ImapMessage[]; maxUid: number }> {
    const client = await this.connect(account);

    try {
      const mailbox = await client.mailboxOpen('INBOX');
      const bootstrapWindow = options?.bootstrapMessageWindow ?? 0;
      const isBootstrap = lastUid === 0 && bootstrapWindow > 0;
      const range = isBootstrap
        ? `${Math.max(1, mailbox.exists - bootstrapWindow + 1)}:*`
        : `${Math.max(1, lastUid + 1)}:*`;
      const messages: ImapMessage[] = [];
      let maxUid = lastUid;

      for await (const item of client.fetch(range, {
        uid: true,
        envelope: true,
        source: true,
        internalDate: true,
        headers: true,
      })) {
        const uid = Number(item.uid ?? 0);
        if (!uid || uid <= lastUid) {
          continue;
        }

        maxUid = Math.max(maxUid, uid);

        const sourceBuffer = Buffer.isBuffer(item.source)
          ? item.source
          : item.source
            ? Buffer.from(item.source as Uint8Array)
            : Buffer.alloc(0);
        const parsed = await simpleParser(sourceBuffer);

        const fromAddress = parsed.from?.value?.[0]
          ? toParsedAddress({
              name: parsed.from.value[0].name,
              address: parsed.from.value[0].address,
            })
          : { name: '', address: '' };

        const toAddresses = (parsed.to?.value ?? []).map((entry) =>
          toParsedAddress({ name: entry.name, address: entry.address }),
        );
        const ccAddresses = (parsed.cc?.value ?? []).map((entry) =>
          toParsedAddress({ name: entry.name, address: entry.address }),
        );

        const headerRecord = parsed.headers;
        const inReplyTo = typeof headerRecord.get('in-reply-to') === 'string'
          ? String(headerRecord.get('in-reply-to'))
          : null;

        const referencesRaw = headerRecord.get('references');
        const references = typeof referencesRaw === 'string'
          ? referencesRaw.split(/\s+/g).filter(Boolean)
          : [];

        const fallbackText = typeof parsed.html === 'string' ? htmlToText(parsed.html) : '';
        messages.push({
          uid,
          messageId: parsed.messageId?.trim() || `<snd-fallback-${uid}@local>`,
          inReplyTo,
          references,
          subject: parsed.subject?.trim() || '(no subject)',
          from: fromAddress,
          to: toAddresses,
          cc: ccAddresses,
          sentAt: parsed.date ? parsed.date.getTime() : item.internalDate ? new Date(item.internalDate).getTime() : Date.now(),
          text: parsed.text?.trim() || fallbackText,
          headers: JSON.stringify(Object.fromEntries(parsed.headers.entries())),
        });
      }

      return { messages, maxUid };
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  private async connect(account: SndAccountConfig): Promise<ImapFlow> {
    if (account.imap.auth === 'password') {
      const password = this.credentialStore.getSecret(`imap:${account.id}:password`);
      if (!password) {
        throw new Error(`Missing IMAP password secret for account ${account.id}. Run: snd auth --account ${account.id} --imap-password`);
      }

      const client = new ImapFlow({
        host: account.imap.host,
        port: account.imap.port,
        secure: account.imap.secure,
        logger: false,
        auth: {
          user: account.imap.username,
          pass: password,
        },
      });

      await client.connect();
      return client;
    }

    if (!account.oauth) {
      throw new Error(`Account ${account.id} uses oauth2 but has no oauth config in config.yaml`);
    }

    const rawSecret = this.credentialStore.getSecret(`imap:${account.id}:oauth`);
    if (!rawSecret) {
      throw new Error(`Missing OAuth refresh token for ${account.id}. Run: snd auth --account ${account.id} --gmail`);
    }

    const oauthSecret = JSON.parse(rawSecret) as OAuthSecret;
    const token = await this.gmailOauthService.refreshAccessToken({
      refreshToken: oauthSecret.refreshToken,
      clientId: account.oauth.clientId,
      clientSecret: account.oauth.clientSecret,
    });

    const client = new ImapFlow({
      host: account.imap.host,
      port: account.imap.port,
      secure: account.imap.secure,
      logger: false,
      auth: {
        user: account.imap.username,
        accessToken: token.accessToken,
      },
    });

    await client.connect();
    return client;
  }
}
