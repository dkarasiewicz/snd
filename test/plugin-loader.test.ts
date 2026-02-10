import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginLoaderService } from '../src/agent/plugins/plugin-loader.service.js';
import { sndConfigSchema } from '../src/config/schema.js';

let tempRoot = '';

function mkTemp(): string {
  tempRoot = fs.mkdtempSync(path.join(process.cwd(), '.tmp-snd-plugins-'));
  return tempRoot;
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

afterEach(() => {
  if (tempRoot && fs.existsSync(tempRoot)) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  tempRoot = '';
});

describe('PluginLoaderService', () => {
  it('loads global and project plugins with project override precedence', async () => {
    const root = mkTemp();
    const globalRoot = path.join(root, 'global');
    const projectRoot = path.join(root, 'project');

    writeFile(
      path.join(globalRoot, 'tools', 'reply.mjs'),
      `export default async function registerTool(){ return { name: 'tool-global' }; }`,
    );
    writeFile(
      path.join(projectRoot, 'tools', 'reply.mjs'),
      `export default async function registerTool(){ return { name: 'tool-project' }; }`,
    );
    fs.mkdirSync(path.join(projectRoot, 'skills', 'writer'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'skills', 'writer', 'SKILL.md'), '# writer\n', 'utf8');

    const config = sndConfigSchema.parse({
      agent: {
        enabled: true,
        plugins: { enabled: true, roots: [globalRoot, projectRoot] },
        tools: { enabled: true },
        skills: { enabled: true },
        subagents: { enabled: true },
        sandbox: { enabled: false },
      },
    });

    const loader = new PluginLoaderService();
    (loader as { dynamicImporter: (specifier: string) => Promise<Record<string, unknown>> }).dynamicImporter =
      async (specifier) => ({
        default: async () => ({
          name: specifier.includes('/project/') ? 'tool-project' : 'tool-global',
        }),
      });
    const result = await loader.load(config, {} as never, {} as never);

    expect(result.tools).toHaveLength(1);
    expect((result.tools[0]?.tool as { name: string }).name).toBe('tool-project');
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.id).toBe('writer');
  });

  it('reports malformed plugin modules and continues loading', async () => {
    const root = mkTemp();
    const globalRoot = path.join(root, 'global');

    writeFile(path.join(globalRoot, 'tools', 'bad.mjs'), 'export default 123;');
    writeFile(
      path.join(globalRoot, 'tools', 'good.mjs'),
      `export default async function registerTool(){ return { name: 'tool-good' }; }`,
    );

    const config = sndConfigSchema.parse({
      agent: {
        enabled: true,
        plugins: { enabled: true, roots: [globalRoot] },
        tools: { enabled: true },
        skills: { enabled: false },
        subagents: { enabled: false },
        sandbox: { enabled: false },
      },
    });

    const loader = new PluginLoaderService();
    (loader as { dynamicImporter: (specifier: string) => Promise<Record<string, unknown>> }).dynamicImporter =
      async (specifier) => {
        if (specifier.includes('bad.mjs')) {
          return { default: 123 };
        }

        return {
          default: async () => ({ name: 'tool-good' }),
        };
      };
    const result = await loader.load(config, {} as never, {} as never);

    expect(result.tools).toHaveLength(1);
    expect((result.tools[0]?.tool as { name: string }).name).toBe('tool-good');
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    expect(result.issues[0]?.kind).toBe('tool');
  });
});
