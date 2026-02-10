import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Injectable, Logger } from '@nestjs/common';
import { SndConfig } from '../../config/schema.js';
import { SND_HOME, SND_PLUGINS_DIR, SND_PROJECT_PLUGINS_DIR } from '../../core/paths.js';
import { MemoryService } from '../../memory/memory.service.js';
import { StoreService } from '../store/store.service.js';
import {
  PluginContext,
  PluginLoadIssue,
  PluginLoadResult,
  PluginScope,
  SandboxFactory,
  SkillComponent,
  SubAgentFactory,
  ToolFactory,
} from './types.js';

const MODULE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

@Injectable()
export class PluginLoaderService {
  private readonly logger = new Logger(PluginLoaderService.name);
  private readonly dynamicImporter = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<Record<string, unknown>>;

  async load(config: SndConfig, memoryService: MemoryService, storeService: StoreService): Promise<PluginLoadResult> {
    const roots = this.resolveRoots(config);
    const issues: PluginLoadIssue[] = [];
    const context: PluginContext = {
      config,
      logger: this.logger,
      cwd: process.cwd(),
      sndHome: SND_HOME,
      memoryService,
      storeService,
    };

    const tools = new Map<string, { id: string; scope: PluginScope; sourcePath: string; tool: unknown }>();
    const subagents = new Map<string, { id: string; scope: PluginScope; sourcePath: string; subagent: unknown }>();
    const sandboxes = new Map<string, { id: string; scope: PluginScope; sourcePath: string; sandbox: unknown }>();
    const skills = new Map<string, SkillComponent>();

    if (!config.agent.plugins.enabled) {
      return {
        roots,
        tools: [],
        subagents: [],
        sandboxes: [],
        skills: [],
        issues,
      };
    }

    for (const root of roots) {
      const scope = this.resolveScope(root);
      if (!fs.existsSync(root)) {
        continue;
      }

      if (config.agent.tools.enabled) {
        await this.loadModuleKind<ToolFactory>({
          root,
          scope,
          folder: 'tools',
          kind: 'tool',
          issues,
          context,
          onLoaded: async (id, sourcePath, factory) => {
            tools.set(id, {
              id,
              scope,
              sourcePath,
              tool: await factory(context),
            });
          },
        });
      }

      if (config.agent.subagents.enabled) {
        await this.loadModuleKind<SubAgentFactory>({
          root,
          scope,
          folder: 'subagents',
          kind: 'subagent',
          issues,
          context,
          onLoaded: async (id, sourcePath, factory) => {
            subagents.set(id, {
              id,
              scope,
              sourcePath,
              subagent: await factory(context),
            });
          },
        });
      }

      if (config.agent.sandbox.enabled) {
        await this.loadModuleKind<SandboxFactory>({
          root,
          scope,
          folder: 'sandboxes',
          kind: 'sandbox',
          issues,
          context,
          onLoaded: async (id, sourcePath, factory) => {
            sandboxes.set(id, {
              id,
              scope,
              sourcePath,
              sandbox: await factory(context),
            });
          },
        });
      }

      if (config.agent.skills.enabled) {
        this.loadSkills(root, scope, issues, skills);
      }
    }

    return {
      roots,
      tools: sortById(Array.from(tools.values())),
      subagents: sortById(Array.from(subagents.values())),
      sandboxes: sortById(Array.from(sandboxes.values())),
      skills: sortById(Array.from(skills.values())),
      issues,
    };
  }

  private resolveRoots(config: SndConfig): string[] {
    const configured = config.agent.plugins.roots;
    const defaults = [SND_PLUGINS_DIR, SND_PROJECT_PLUGINS_DIR];
    const roots = configured.length > 0 ? configured : defaults;
    return Array.from(new Set(roots.map((entry) => path.resolve(entry))));
  }

  private resolveScope(root: string): PluginScope {
    const resolvedRoot = path.resolve(root);
    const resolvedProject = path.resolve(SND_PROJECT_PLUGINS_DIR);
    if (resolvedRoot === resolvedProject) {
      return 'project';
    }

    return 'global';
  }

  private async loadModuleKind<TFactory extends ToolFactory | SubAgentFactory | SandboxFactory>(input: {
    root: string;
    scope: PluginScope;
    folder: 'tools' | 'subagents' | 'sandboxes';
    kind: 'tool' | 'subagent' | 'sandbox';
    issues: PluginLoadIssue[];
    context: PluginContext;
    onLoaded: (id: string, sourcePath: string, factory: TFactory) => Promise<void>;
  }): Promise<void> {
    const targetDir = path.join(input.root, input.folder);
    if (!fs.existsSync(targetDir)) {
      return;
    }

    for (const sourcePath of listModuleFiles(targetDir)) {
      const id = path.basename(sourcePath, path.extname(sourcePath));
      try {
        const module = await this.dynamicImporter(pathToFileURL(sourcePath).href);
        const factory = module.default;
        if (typeof factory !== 'function') {
          input.issues.push({
            kind: input.kind,
            sourcePath,
            message: 'Expected default export function.',
          });
          continue;
        }

        await input.onLoaded(id, sourcePath, factory as TFactory);
      } catch (error) {
        input.issues.push({
          kind: input.kind,
          sourcePath,
          message: (error as Error).message,
        });
      }
    }
  }

  private loadSkills(
    root: string,
    scope: PluginScope,
    issues: PluginLoadIssue[],
    skills: Map<string, SkillComponent>,
  ): void {
    const skillsDir = path.join(root, 'skills');
    if (!fs.existsSync(skillsDir)) {
      return;
    }

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    } catch (error) {
      issues.push({
        kind: 'skill',
        sourcePath: skillsDir,
        message: (error as Error).message,
      });
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillPath = path.join(skillsDir, entry.name);
      const skillSpecPath = path.join(skillPath, 'SKILL.md');
      if (!fs.existsSync(skillSpecPath)) {
        issues.push({
          kind: 'skill',
          sourcePath: skillPath,
          message: 'Missing SKILL.md',
        });
        continue;
      }

      skills.set(entry.name, {
        id: entry.name,
        scope,
        sourcePath: skillPath,
        skillPath,
      });
    }
  }
}

function listModuleFiles(targetDir: string): string[] {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(targetDir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isFile() && MODULE_EXTENSIONS.has(path.extname(entry.name)))
    .map((entry) => path.join(targetDir, entry.name))
    .sort();
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return items.slice().sort((a, b) => a.id.localeCompare(b.id));
}
