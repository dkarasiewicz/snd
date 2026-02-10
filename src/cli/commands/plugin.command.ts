import { Command, CommandRunner } from 'nest-commander';
import { PluginRegistryService } from '../../agent/plugins/plugin-registry.service.js';

@Command({
  name: 'plugin',
  description: 'Inspect plugin components and validate plugin loading',
  arguments: '[action]',
})
export class PluginCommand extends CommandRunner {
  constructor(private readonly pluginRegistryService: PluginRegistryService) {
    super();
  }

  override async run(params: string[]): Promise<void> {
    const action = (params[0] ?? 'list').toLowerCase();
    if (action !== 'list' && action !== 'check') {
      throw new Error('plugin action must be one of: list, check');
    }

    const plugins = await this.pluginRegistryService.getPlugins(action === 'check');

    process.stdout.write(`plugin roots (${plugins.roots.length})\n`);
    for (const root of plugins.roots) {
      process.stdout.write(`- ${root}\n`);
    }

    process.stdout.write(`tools: ${plugins.tools.length}\n`);
    for (const tool of plugins.tools) {
      process.stdout.write(`- ${tool.id} (${tool.scope}) ${tool.sourcePath}\n`);
    }

    process.stdout.write(`subagents: ${plugins.subagents.length}\n`);
    for (const subagent of plugins.subagents) {
      process.stdout.write(`- ${subagent.id} (${subagent.scope}) ${subagent.sourcePath}\n`);
    }

    process.stdout.write(`sandboxes: ${plugins.sandboxes.length}\n`);
    for (const sandbox of plugins.sandboxes) {
      process.stdout.write(`- ${sandbox.id} (${sandbox.scope}) ${sandbox.sourcePath}\n`);
    }

    process.stdout.write(`skills: ${plugins.skills.length}\n`);
    for (const skill of plugins.skills) {
      process.stdout.write(`- ${skill.id} (${skill.scope}) ${skill.skillPath}\n`);
    }

    if (plugins.issues.length === 0) {
      process.stdout.write('plugin issues: none\n');
      return;
    }

    process.stdout.write(`plugin issues: ${plugins.issues.length}\n`);
    for (const issue of plugins.issues) {
      process.stdout.write(`- [${issue.kind}] ${issue.sourcePath}: ${issue.message}\n`);
    }

    if (action === 'check') {
      throw new Error('plugin check failed');
    }
  }
}
