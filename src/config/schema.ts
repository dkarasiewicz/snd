import { z } from 'zod';

function nullAsUndefined<T extends z.ZodTypeAny>(schema: T): z.ZodEffects<z.ZodOptional<T>, z.output<T> | undefined, unknown> {
  return z.preprocess((value) => (value === null ? undefined : value), schema.optional());
}

const imapConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  secure: z.boolean().default(true),
  username: z.string().min(1),
  auth: z.enum(['password', 'oauth2']).default('password'),
});

const gmailOauthSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
});

export const accountSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  provider: z.enum(['gmail', 'generic']).default('generic'),
  imap: imapConfigSchema,
  oauth: nullAsUndefined(gmailOauthSchema),
  rulesProfile: z.string().default('default'),
});

const styleRuleSchema = z.object({
  match: z.string().min(1),
  vibe: z.string().min(1),
});

const pollSchema = z.object({
  intervalSeconds: z.number().int().min(30).max(86400).default(300),
});

const llmSchema = z.object({
  provider: z.enum(['openai-compatible']).default('openai-compatible'),
  baseUrl: nullAsUndefined(z.string().url()),
  model: z.string().min(1).default('gpt-4o-mini'),
  apiKeySecretKey: z.string().min(1).default('llm:default'),
  useDeepAgents: z.boolean().default(true),
});

const rulesSchema = z.object({
  ignoreSenders: z.array(z.string().min(1)).default([]),
  ignoreDomains: z.array(z.string().min(1)).default([]),
  globalVibe: z.string().default('brief, technical, direct'),
  styles: z.array(styleRuleSchema).default([]),
});

export const sndConfigSchema = z.object({
  version: z.literal(1).default(1),
  defaultAccountId: nullAsUndefined(z.string()),
  poll: pollSchema.default({ intervalSeconds: 300 }),
  llm: llmSchema.default({
    provider: 'openai-compatible',
    model: 'gpt-4o-mini',
    apiKeySecretKey: 'llm:default',
    useDeepAgents: true,
  }),
  rules: rulesSchema.default({
    ignoreSenders: [],
    ignoreDomains: [],
    globalVibe: 'brief, technical, direct',
    styles: [],
  }),
  accounts: z.array(accountSchema).default([]),
});

export type SndConfig = z.infer<typeof sndConfigSchema>;
export type SndAccountConfig = z.infer<typeof accountSchema>;
