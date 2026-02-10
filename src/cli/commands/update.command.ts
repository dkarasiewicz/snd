import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Command, CommandRunner, Option } from 'nest-commander';

type UpdateOptions = {
  scriptUrl?: string;
  repoUrl?: string;
  installDir?: string;
  binDir?: string;
};

const DEFAULT_INSTALL_SCRIPT_URL = 'https://raw.githubusercontent.com/dkarasiewicz/snd/main/scripts/install.sh';

@Command({
  name: 'update',
  description: 'Update snd using the installer script',
})
export class UpdateCommand extends CommandRunner {
  override async run(_params: string[], options?: UpdateOptions): Promise<void> {
    const scriptUrl = options?.scriptUrl ?? DEFAULT_INSTALL_SCRIPT_URL;

    process.stdout.write(`fetching installer: ${scriptUrl}\n`);

    const script = await loadInstallerScript(scriptUrl);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...(options?.repoUrl ? { SND_REPO_URL: options.repoUrl } : {}),
      ...(options?.installDir ? { SND_INSTALL_DIR: options.installDir } : {}),
      ...(options?.binDir ? { SND_BIN_DIR: options.binDir } : {}),
    };

    await runScript(script, env);
    process.stdout.write('snd update complete\n');
  }

  @Option({
    flags: '--script-url [url]',
    description: 'Installer script URL/path (default: GitHub raw main/install.sh)',
  })
  parseScriptUrl(value: string): string {
    return value;
  }

  @Option({
    flags: '--repo-url [url]',
    description: 'Override SND_REPO_URL for installer (advanced)',
  })
  parseRepoUrl(value: string): string {
    return value;
  }

  @Option({
    flags: '--install-dir [path]',
    description: 'Override SND_INSTALL_DIR for installer (advanced)',
  })
  parseInstallDir(value: string): string {
    return value;
  }

  @Option({
    flags: '--bin-dir [path]',
    description: 'Override SND_BIN_DIR for installer (advanced)',
  })
  parseBinDir(value: string): string {
    return value;
  }
}

function runScript(script: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-s'], {
      env,
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Installer terminated by signal: ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Installer failed with exit code ${code ?? 'unknown'}`));
        return;
      }

      resolve();
    });

    child.stdin.write(script);
    child.stdin.end();
  });
}

async function loadInstallerScript(source: string): Promise<string> {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch installer: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  if (source.startsWith('file://')) {
    return readFile(fileURLToPath(source), 'utf8');
  }

  return readFile(source, 'utf8');
}
