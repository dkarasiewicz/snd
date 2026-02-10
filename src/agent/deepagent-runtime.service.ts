import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service.js';
import { StoreService } from './store/store.service.js';
import { SqliteStoreBackend } from './store/sqlite-store-backend.js';
import { PluginRegistryService } from './plugins/plugin-registry.service.js';
import { DeepAgentModelFactory } from './deepagent-model.factory.js';
import { DEEPAGENT_SYSTEM_PROMPT, buildDeepAgentUserPrompt } from './deepagent-prompt.js';
import { DraftRequest } from './types.js';

type DeepAgentLike = {
  invoke: (payload: Record<string, unknown>, config?: Record<string, unknown>) => Promise<unknown>;
};

type CreateDeepAgent = (input: Record<string, unknown>) => Promise<unknown> | unknown;

type CachedRuntime = {
  signature: string;
  agent: DeepAgentLike;
};

@Injectable()
export class DeepAgentRuntimeService {
  private readonly logger = new Logger(DeepAgentRuntimeService.name);
  private readonly dynamicImporter = new Function(
    'specifier',
    'return import(specifier)',
  ) as (specifier: string) => Promise<Record<string, unknown>>;

  private cachedRuntime: CachedRuntime | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly storeService: StoreService,
    private readonly pluginRegistryService: PluginRegistryService,
    private readonly deepAgentModelFactory: DeepAgentModelFactory,
  ) {}

  async maybeGenerate(request: DraftRequest): Promise<string | null> {
    const config = this.configService.load();
    if (!config.agent.enabled) {
      return null;
    }

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

    try {
      const runtime = await this.getOrCreateRuntime(createDeepAgent as CreateDeepAgent);
      const namespace = this.storeService.namespaceForDraftRequest(request);
      const longTermMemory = this.storeService
        .list(namespace, 'memory:')
        .slice(0, 20)
        .map((entry) => ({
          key: entry.key,
          value: entry.value,
        }));

      const prompt = buildDeepAgentUserPrompt({
        request,
        longTermMemory,
      });

      const payload = {
        messages: [{ role: 'user', content: prompt }],
      };
      const invokeConfig = {
        configurable: {
          thread_id: request.threadId,
          user_id: request.messages[0]?.accountId ?? 'local',
        },
      };

      let rawResult: unknown;
      try {
        rawResult = await runtime.agent.invoke(payload, invokeConfig);
      } catch {
        rawResult = await runtime.agent.invoke(payload);
      }

      const content = this.extractText(rawResult);
      if (!content) {
        return null;
      }

      this.persistResultMemory(namespace, request.threadId, content, rawResult);
      return content;
    } catch (error) {
      this.logger.warn(`deepagent runtime failed: ${(error as Error).message}`);
      return null;
    }
  }

  private async getOrCreateRuntime(createDeepAgent: CreateDeepAgent): Promise<CachedRuntime> {
    const config = this.configService.load();
    const plugins = await this.pluginRegistryService.getPlugins();
    const signature = JSON.stringify({
      model: config.llm.model,
      baseUrl: config.llm.baseUrl ?? null,
      agent: config.agent,
      tools: plugins.tools.map((entry) => `${entry.scope}:${entry.id}:${entry.sourcePath}`),
      subagents: plugins.subagents.map((entry) => `${entry.scope}:${entry.id}:${entry.sourcePath}`),
      sandboxes: plugins.sandboxes.map((entry) => `${entry.scope}:${entry.id}:${entry.sourcePath}`),
      skills: plugins.skills.map((entry) => `${entry.scope}:${entry.id}:${entry.skillPath}`),
    });

    if (this.cachedRuntime && this.cachedRuntime.signature === signature) {
      return this.cachedRuntime;
    }

    const modelConfig = this.deepAgentModelFactory.buildModelConfig();
    const tools = [
      ...this.createBuiltinTools(),
      ...plugins.tools.map((entry) => entry.tool),
    ];

    const candidateInputs: Record<string, unknown>[] = [
      {
        ...modelConfig,
        systemPrompt: DEEPAGENT_SYSTEM_PROMPT,
        tools,
        subagents: plugins.subagents.map((entry) => entry.subagent),
        skills: plugins.skills.map((entry) => entry.skillPath),
        sandbox: plugins.sandboxes[0]?.sandbox,
        store: new SqliteStoreBackend(this.storeService, this.storeService.makeNamespace({ scope: 'deepagent' })),
      },
      {
        systemPrompt: DEEPAGENT_SYSTEM_PROMPT,
        tools,
      },
    ];

    let lastError: Error | null = null;
    for (const input of candidateInputs) {
      try {
        const agent = await createDeepAgent(input);
        if (this.isDeepAgentLike(agent)) {
          const runtime = {
            signature,
            agent,
          };
          this.cachedRuntime = runtime;
          return runtime;
        }
      } catch (error) {
        lastError = error as Error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error('deepagent creation failed: missing invoke method');
  }

  private createBuiltinTools(): unknown[] {
    return [
      {
        name: 'snd_write_memory',
        description: 'Persist durable memory for future drafts. Input: {namespace, key, value}',
        invoke: async (input: { namespace: string; key: string; value: string }) => {
          if (!input?.namespace || !input?.key || !input?.value) {
            throw new Error('snd_write_memory requires namespace, key, value');
          }

          this.storeService.put(input.namespace, input.key, input.value);
          return 'ok';
        },
      },
      {
        name: 'snd_list_memory',
        description: 'List memory records. Input: {namespace, prefix?}',
        invoke: async (input: { namespace: string; prefix?: string }) => {
          if (!input?.namespace) {
            throw new Error('snd_list_memory requires namespace');
          }

          return this.storeService.list(input.namespace, input.prefix).map((entry) => ({
            key: entry.key,
            value: entry.value,
            updatedAt: entry.updatedAt,
          }));
        },
      },
    ];
  }

  private persistResultMemory(namespace: string, threadId: string, content: string, rawResult: unknown): void {
    this.storeService.put(namespace, `draft:${threadId}:latest`, content);

    const extracted = extractMemoryUpdates(rawResult);
    for (const update of extracted) {
      this.storeService.put(namespace, `memory:${update.key}`, update.value);
    }
  }

  private extractText(result: unknown): string | null {
    if (typeof result === 'string') {
      const trimmed = result.trim();
      return trimmed || null;
    }

    if (!result || typeof result !== 'object') {
      return null;
    }

    const asRecord = result as Record<string, unknown>;

    for (const key of ['output', 'draft', 'content']) {
      const value = asRecord[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    const messages = asRecord.messages;
    if (Array.isArray(messages) && messages.length > 0) {
      const last = messages[messages.length - 1];
      const extracted = extractMessageText(last);
      if (extracted) {
        return extracted;
      }
    }

    return null;
  }

  private isDeepAgentLike(input: unknown): input is DeepAgentLike {
    return Boolean(input && typeof input === 'object' && typeof (input as { invoke?: unknown }).invoke === 'function');
  }
}

function extractMessageText(message: unknown): string | null {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') {
    const trimmed = content.trim();
    return trimmed || null;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const joined = content
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }

      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return String((part as { text: string }).text);
      }

      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();

  return joined || null;
}

function extractMemoryUpdates(result: unknown): Array<{ key: string; value: string }> {
  if (!result || typeof result !== 'object') {
    return [];
  }

  const source = (result as { memories?: unknown; memoryUpdates?: unknown }).memories
    ?? (result as { memoryUpdates?: unknown }).memoryUpdates;

  if (!Array.isArray(source)) {
    return [];
  }

  const updates: Array<{ key: string; value: string }> = [];
  for (const entry of source) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const key = (entry as { key?: unknown }).key;
    const value = (entry as { value?: unknown }).value;
    if (typeof key !== 'string' || !key.trim()) {
      continue;
    }

    if (typeof value !== 'string' || !value.trim()) {
      continue;
    }

    updates.push({
      key: key.trim(),
      value: value.trim(),
    });
  }

  return updates;
}
