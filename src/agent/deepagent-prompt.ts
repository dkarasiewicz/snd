import { snippet } from '../imap/threading.js';
import { DraftRequest } from './types.js';

type BuildDeepAgentPromptInput = {
  request: DraftRequest;
  longTermMemory: Array<{ key: string; value: string }>;
};

export const DEEPAGENT_SYSTEM_PROMPT = [
  'You are snd, a local technical email drafting agent.',
  'Objective: produce a concise, high-quality draft reply for the latest inbound email.',
  'Reasoning policy:',
  '- Plan internal todos before writing.',
  '- Keep internal reasoning concise and private.',
  '- Use durable memory only for stable, reusable user/style facts.',
  '- Do not store transient details unless they improve future drafts.',
  'Output policy:',
  '- Return only draft body text.',
  '- No markdown fences or meta commentary.',
  '- No subject line.',
  '- Never claim to send email.',
  '- Final send is done in user email client.',
  'Tone policy: brief, direct, technical, pragmatic.',
].join('\n');

export function buildDeepAgentUserPrompt(input: BuildDeepAgentPromptInput): string {
  const { request, longTermMemory } = input;
  const messages = request.messages.slice(-8).map((message) => {
    const sentAt = new Date(message.sentAt).toISOString();
    return `From: ${message.fromAddress}\nAt: ${sentAt}\nBody: ${snippet(message.bodyText, 420)}`;
  });

  const memoryLines = longTermMemory.length > 0
    ? longTermMemory.map((entry) => `- ${entry.key}: ${entry.value}`)
    : ['- (none)'];

  return [
    `Thread ID: ${request.threadId}`,
    `Vibe: ${request.vibe}`,
    request.instruction ? `Extra instruction: ${request.instruction}` : null,
    `User notes: ${request.userNotes.length > 0 ? request.userNotes.join(' | ') : 'none'}`,
    `Thread notes: ${request.threadNotes.length > 0 ? request.threadNotes.join(' | ') : 'none'}`,
    'Long-term memory:',
    ...memoryLines,
    'Thread context:',
    ...messages,
    'Task: Draft the reply for the latest inbound message. Keep it short and actionable.',
  ]
    .filter(Boolean)
    .join('\n\n');
}
