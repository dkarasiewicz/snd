import { Module } from '@nestjs/common';
import { AuthCommand } from './cli/commands/auth.command.js';
import { ConfigCommand } from './cli/commands/config.command.js';
import { InboxCommand } from './cli/commands/inbox.command.js';
import { InitCommand } from './cli/commands/init.command.js';
import { MemoryCommand } from './cli/commands/memory.command.js';
import { RuleCommand } from './cli/commands/rule.command.js';
import { RunCommand } from './cli/commands/run.command.js';
import { ThreadCommand } from './cli/commands/thread.command.js';
import { UpdateCommand } from './cli/commands/update.command.js';
import { DeepAgentsAdapterService } from './agent/deepagents-adapter.service.js';
import { DraftAgentService } from './agent/draft-agent.service.js';
import { ConfigService } from './config/config.service.js';
import { CredentialStoreService } from './core/credential-store.service.js';
import { RunnerService } from './core/runner.service.js';
import { SyncService } from './core/sync.service.js';
import { ThreadService } from './core/thread.service.js';
import { GmailOauthService } from './imap/gmail-oauth.service.js';
import { ImapClientService } from './imap/imap-client.service.js';
import { MemoryService } from './memory/memory.service.js';
import { RuleEngineService } from './rules/rule-engine.service.js';
import { DatabaseService } from './storage/database.service.js';
import { BirdUiService } from './ui/bird-ui.service.js';

@Module({
  providers: [
    // commands
    InitCommand,
    AuthCommand,
    RunCommand,
    InboxCommand,
    ThreadCommand,
    ConfigCommand,
    RuleCommand,
    MemoryCommand,
    UpdateCommand,

    // services
    ConfigService,
    CredentialStoreService,
    DatabaseService,
    GmailOauthService,
    ImapClientService,
    RuleEngineService,
    MemoryService,
    DeepAgentsAdapterService,
    DraftAgentService,
    SyncService,
    RunnerService,
    ThreadService,
    BirdUiService,
  ],
})
export class AppModule {}
