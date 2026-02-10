import { Logger } from '@nestjs/common';
import { SndConfig } from '../../config/schema.js';
import { MemoryService } from '../../memory/memory.service.js';
import { StoreService } from '../store/store.service.js';

export type PluginScope = 'global' | 'project';

export type PluginContext = {
  config: SndConfig;
  logger: Logger;
  cwd: string;
  sndHome: string;
  memoryService: MemoryService;
  storeService: StoreService;
};

export type ToolFactory = (context: PluginContext) => Promise<unknown> | unknown;
export type SubAgentFactory = (context: PluginContext) => Promise<unknown> | unknown;
export type SandboxFactory = (context: PluginContext) => Promise<unknown> | unknown;

export type ToolComponent = {
  id: string;
  scope: PluginScope;
  sourcePath: string;
  tool: unknown;
};

export type SubAgentComponent = {
  id: string;
  scope: PluginScope;
  sourcePath: string;
  subagent: unknown;
};

export type SandboxComponent = {
  id: string;
  scope: PluginScope;
  sourcePath: string;
  sandbox: unknown;
};

export type SkillComponent = {
  id: string;
  scope: PluginScope;
  sourcePath: string;
  skillPath: string;
};

export type PluginLoadIssue = {
  kind: 'tool' | 'subagent' | 'sandbox' | 'skill';
  sourcePath: string;
  message: string;
};

export type PluginLoadResult = {
  roots: string[];
  tools: ToolComponent[];
  subagents: SubAgentComponent[];
  sandboxes: SandboxComponent[];
  skills: SkillComponent[];
  issues: PluginLoadIssue[];
};
