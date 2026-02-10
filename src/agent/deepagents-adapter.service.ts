import { Injectable, Logger } from '@nestjs/common';
import { DraftRequest } from './types.js';

@Injectable()
export class DeepAgentsAdapterService {
  private readonly logger = new Logger(DeepAgentsAdapterService.name);
  private readonly dynamicImporter = new Function(
    'specifier',
    'return import(specifier)',
  ) as (specifier: string) => Promise<Record<string, unknown>>;

  async maybeGenerate(request: DraftRequest, enabled: boolean): Promise<string | null> {
    if (!enabled) {
      return null;
    }

    // Optional integration path: if the deepagents package is installed and exports
    // a compatible API, use it. Otherwise fallback is handled by DraftAgentService.
    let deepagents: Record<string, unknown> | null = null;
    try {
      deepagents = await this.dynamicImporter('deepagents');
    } catch {
      this.logger.debug('deepagents package not installed; falling back to direct LLM API');
      return null;
    }

    const createDeepAgent = deepagents.createDeepAgent;
    if (typeof createDeepAgent !== 'function') {
      this.logger.debug('deepagents.createDeepAgent not available; falling back to direct LLM API');
      return null;
    }

    // Keep this adapter permissive because deepagents APIs may evolve.
    try {
      const agent = await (createDeepAgent as (input: Record<string, unknown>) => Promise<unknown> | unknown)({
        tools: [],
        systemPrompt:
          'You are snd: brief, direct, technical email drafting agent. Return only the final draft text.',
      });

      if (!agent || typeof agent !== 'object' || !("invoke" in agent)) {
        return null;
      }

      const invoke = (agent as { invoke: (payload: Record<string, unknown>) => Promise<unknown> }).invoke;
      const prompt = [
        `Thread: ${request.threadId}`,
        `Vibe: ${request.vibe}`,
        request.instruction ? `Instruction: ${request.instruction}` : null,
        'User notes:',
        request.userNotes.length > 0 ? request.userNotes.join(' | ') : 'none',
        'Thread notes:',
        request.threadNotes.length > 0 ? request.threadNotes.join(' | ') : 'none',
        'Messages:',
        ...request.messages.map(
          (message) => `${new Date(message.sentAt).toISOString()} ${message.fromAddress}: ${message.bodyText}`,
        ),
        'Write concise reply draft. Output only draft body.',
      ]
        .filter(Boolean)
        .join('\n');

      const result = await invoke({
        messages: [{ role: 'user', content: prompt }],
      });

      if (typeof result === 'string') {
        return result.trim();
      }

      if (result && typeof result === 'object') {
        const asRecord = result as Record<string, unknown>;
        const maybeOutput = asRecord.output;
        if (typeof maybeOutput === 'string') {
          return maybeOutput.trim();
        }

        const maybeMessages = asRecord.messages;
        if (Array.isArray(maybeMessages) && maybeMessages.length > 0) {
          const last = maybeMessages[maybeMessages.length - 1];
          const text = this.extractTextFromMessage(last);
          if (text) {
            return text;
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.warn(`deepagents invocation failed: ${(error as Error).message}`);
      return null;
    }
  }

  private extractTextFromMessage(message: unknown): string | null {
    if (!message || typeof message !== 'object') {
      return null;
    }

    const content = (message as { content?: unknown }).content;
    if (typeof content === 'string') {
      return content.trim();
    }

    if (Array.isArray(content)) {
      const flattened = content
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }
          if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
            return (part as { text: string }).text;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n')
        .trim();
      return flattened || null;
    }

    return null;
  }
}
