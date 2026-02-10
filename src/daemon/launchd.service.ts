import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import {
  ensureSndHome,
  ensureSndRuntimeDirs,
  SND_LAUNCHD_LABEL,
  SND_LAUNCHD_PLIST_PATH,
  SND_LOG_DIR,
} from '../core/paths.js';

type LaunchdSpec = {
  label: string;
  plistPath: string;
  stdoutPath: string;
  stderrPath: string;
  programArguments: string[];
};

export type InstallServiceInput = {
  intervalSeconds: number;
  accountId?: string;
};

export type LaunchdStatus = {
  active: boolean;
  output: string;
};

@Injectable()
export class LaunchdService {
  getLabel(): string {
    return SND_LAUNCHD_LABEL;
  }

  getPlistPath(): string {
    return SND_LAUNCHD_PLIST_PATH;
  }

  buildSpec(input: InstallServiceInput): LaunchdSpec {
    ensureSndHome();
    ensureSndRuntimeDirs();

    const entryScript = resolveCliEntryScript();
    const programArguments = [
      process.execPath,
      entryScript,
      'run',
      '--ui',
      'plain',
      '--interval',
      String(input.intervalSeconds),
    ];

    if (input.accountId) {
      programArguments.push('--account', input.accountId);
    }

    return {
      label: this.getLabel(),
      plistPath: this.getPlistPath(),
      stdoutPath: path.join(SND_LOG_DIR, 'service.out.log'),
      stderrPath: path.join(SND_LOG_DIR, 'service.err.log'),
      programArguments,
    };
  }

  buildPlistXml(spec: LaunchdSpec): string {
    const programArgsXml = spec.programArguments
      .map((arg) => `      <string>${escapeXml(arg)}</string>`)
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${escapeXml(spec.label)}</string>
    <key>ProgramArguments</key>
    <array>
${programArgsXml}
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${escapeXml(spec.stdoutPath)}</string>
    <key>StandardErrorPath</key>
    <string>${escapeXml(spec.stderrPath)}</string>
    <key>WorkingDirectory</key>
    <string>${escapeXml(process.cwd())}</string>
  </dict>
</plist>
`;
  }

  install(input: InstallServiceInput): void {
    assertDarwin();
    const spec = this.buildSpec(input);
    fs.mkdirSync(path.dirname(spec.plistPath), { recursive: true, mode: 0o755 });
    fs.writeFileSync(spec.plistPath, this.buildPlistXml(spec), { mode: 0o644 });

    const domain = launchctlDomain();
    this.runLaunchctl(['bootout', domain, spec.plistPath], true);
    this.runLaunchctl(['bootstrap', domain, spec.plistPath]);
    this.runLaunchctl(['enable', `${domain}/${spec.label}`], true);
    this.runLaunchctl(['kickstart', '-k', `${domain}/${spec.label}`], true);
  }

  uninstall(): void {
    assertDarwin();
    const domain = launchctlDomain();
    const plistPath = this.getPlistPath();
    this.runLaunchctl(['bootout', domain, plistPath], true);

    if (fs.existsSync(plistPath)) {
      fs.unlinkSync(plistPath);
    }
  }

  start(): void {
    assertDarwin();
    const domain = launchctlDomain();
    this.runLaunchctl(['kickstart', '-k', `${domain}/${this.getLabel()}`]);
  }

  stop(): void {
    assertDarwin();
    this.runLaunchctl(['stop', this.getLabel()]);
  }

  status(): LaunchdStatus {
    assertDarwin();
    const domain = launchctlDomain();
    const detailed = this.runLaunchctl(['print', `${domain}/${this.getLabel()}`], true);
    if (detailed.code === 0) {
      return {
        active: true,
        output: detailed.stdout || detailed.stderr,
      };
    }

    const list = this.runLaunchctl(['list', this.getLabel()], true);
    return {
      active: list.code === 0,
      output: list.stdout || list.stderr,
    };
  }

  readLogs(lines = 80): { outPath: string; errPath: string; out: string[]; err: string[] } {
    const spec = this.buildSpec({ intervalSeconds: 300 });

    return {
      outPath: spec.stdoutPath,
      errPath: spec.stderrPath,
      out: readLastLines(spec.stdoutPath, lines),
      err: readLastLines(spec.stderrPath, lines),
    };
  }

  private runLaunchctl(args: string[], allowFailure = false): { code: number; stdout: string; stderr: string } {
    const result = spawnSync('launchctl', args, {
      encoding: 'utf8',
    });

    const code = result.status ?? 1;
    const stdout = result.stdout || '';
    const stderr = result.stderr || '';

    if (code !== 0 && !allowFailure) {
      throw new Error(`launchctl ${args.join(' ')} failed: ${stderr || stdout || `exit ${code}`}`);
    }

    return {
      code,
      stdout,
      stderr,
    };
  }
}

export function resolveCliEntryScript(): string {
  const argvEntry = process.argv[1];
  if (argvEntry && fs.existsSync(argvEntry)) {
    return path.resolve(argvEntry);
  }

  return path.resolve(process.cwd(), 'dist', 'index.js');
}

export function launchctlDomain(): string {
  if (typeof process.getuid !== 'function') {
    throw new Error('launchd service requires POSIX user id support');
  }

  return `gui/${process.getuid()}`;
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function readLastLines(filePath: string, lines: number): string[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const chunks = raw.split(/\r?\n/).filter(Boolean);
  return chunks.slice(Math.max(0, chunks.length - lines));
}

function assertDarwin(): void {
  if (process.platform !== 'darwin') {
    throw new Error('service command is currently supported on macOS only');
  }
}
