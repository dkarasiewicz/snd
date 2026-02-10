import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service.js';
import { CredentialStoreService } from '../core/credential-store.service.js';
import { snippet } from '../imap/threading.js';
import { DeepAgentsAdapterService } from './deepagents-adapter.service.js';
import { DraftRequest, DraftResult } from './types.js';

function trimTo(input: string, maxChars: number): string {
  if (input.length <= maxChars) {
    return input;
  }

  return `${input.slice(0, maxChars - 3)}...`;
}

@Injectable()
export class DraftAgentService {
  constructor(
    private readonly configService: ConfigService,
    private readonly credentialStore: CredentialStoreService,
    private readonly deepAgentsAdapterService: DeepAgentsAdapterService,
  ) {}

  async generateDraft(request: DraftRequest): Promise<DraftResult> {
    const config = this.configService.load();

    const deepAgentsOutput = await this.deepAgentsAdapterService.maybeGenerate(request, config.llm.useDeepAgents);
    if (deepAgentsOutput) {
      return {
        content: deepAgentsOutput,
        model: request.model,
        usedDeepAgents: true,
      };
    }

    const apiKey = this.credentialStore.getSecret(config.llm.apiKeySecretKey);
    if (!apiKey) {
      throw new Error(
        `Missing LLM API token in secret key ${config.llm.apiKeySecretKey}. Run: snd auth --llm-token`,
      );
    }

    const baseUrl = config.llm.baseUrl ?? 'https://api.openai.com/v1';
    const prompt = this.buildPrompt(request);

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              'You are snd, a concise email drafter. Output only the draft reply text. Keep it brief, precise, and technical when relevant.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`LLM request failed: ${response.status} ${response.statusText} - ${trimTo(body, 260)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('LLM response did not include message content');
    }

    return {
      content,
      model: request.model,
      usedDeepAgents: false,
    };
  }

  private buildPrompt(request: DraftRequest): string {
    const lastMessages = request.messages.slice(-8);
    const threadBlock = lastMessages
      .map((message) => {
        const sentAt = new Date(message.sentAt).toISOString();
        return `From: ${message.fromAddress}\nAt: ${sentAt}\nBody: ${snippet(message.bodyText, 420)}`;
      })
      .join('\n\n---\n\n');

    const userNotes = request.userNotes.length > 0 ? request.userNotes.join(' | ') : 'none';
    const threadNotes = request.threadNotes.length > 0 ? request.threadNotes.join(' | ') : 'none';

    return [
      `Vibe: ${request.vibe}`,
      `User notes: ${userNotes}`,
      `Thread notes: ${threadNotes}`,
      request.instruction ? `Extra instruction: ${request.instruction}` : null,
      'Write a reply draft for the most recent inbound email in this thread.',
      'Constraints:',
      '- Keep it concise.',
      '- Do not include subject line.',
      '- Do not mention being an AI.',
      '- Ask for clarification only if required.',
      '',
      'Thread context:',
      threadBlock,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
