import React from 'react';
import { render, useApp } from 'ink';
import {
  renderInboxHeader,
  renderInboxRow,
  renderRunCycleError,
  renderRunCycleSkip,
  renderRunCycleStart,
  renderRunCycleStats,
  renderStop,
  renderThreadHeader,
} from './cli-render.js';
import { InboxScreen } from './ink/inbox-screen.js';
import { RunScreenView } from './ink/run-screen.js';
import { ThreadScreen } from './ink/thread-screen.js';
import { RunnerService } from '../core/runner.service.js';
import { InboxPreviewVm, InboxRowVm } from './view-models/inbox-vm.js';
import { ThreadViewModel } from './view-models/thread-vm.js';

export const UiRenderer = {
  renderRunCycleStart,
  renderRunCycleStats,
  renderRunCycleError,
  renderRunCycleSkip,
  renderStop,
  renderInboxHeader,
  renderInboxRow,
  renderThreadHeader,
};

type RunRichInput = {
  runnerService: RunnerService;
  intervalSeconds: number;
  accountId?: string;
  once: boolean;
  verbose?: boolean;
};

export async function renderRunRich(input: RunRichInput): Promise<void> {
  await new Promise<void>((resolve) => {
    const instance = render(
      <RunScreenView
        runnerService={input.runnerService}
        intervalSeconds={input.intervalSeconds}
        accountId={input.accountId}
        once={input.once}
        verbose={input.verbose}
        onExit={resolve}
      />,
      {
        exitOnCtrlC: true,
      },
    );

    void instance.waitUntilExit().then(() => {
      resolve();
    });
  });
}

type InboxRichInput = {
  limit: number;
  loadRows: () => Promise<InboxRowVm[]>;
  loadPreview: (threadId: string) => Promise<InboxPreviewVm>;
  loadThread: (threadId: string) => Promise<ThreadViewModel>;
  regenerateDraft: (threadId: string) => Promise<void>;
  markDone: (threadId: string) => Promise<void>;
  saveDraft: (threadId: string, content: string) => Promise<void>;
};

export async function renderInboxRich(input: InboxRichInput): Promise<void> {
  await new Promise<void>((resolve) => {
    const instance = render(
      <InboxScreen
        limit={input.limit}
        loadRows={input.loadRows}
        loadPreview={input.loadPreview}
        loadThread={input.loadThread}
        regenerateDraft={input.regenerateDraft}
        markDone={input.markDone}
        saveDraft={input.saveDraft}
        onExit={resolve}
      />,
      {
        exitOnCtrlC: true,
      },
    );

    void instance.waitUntilExit().then(() => {
      resolve();
    });
  });
}

type ThreadRichInput = {
  threadId: string;
  loadThread: (threadId: string) => Promise<ThreadViewModel>;
  regenerateDraft: (threadId: string) => Promise<void>;
  markDone: (threadId: string) => Promise<void>;
  saveDraft: (threadId: string, content: string) => Promise<void>;
};

type ThreadRootProps = ThreadRichInput & {
  onExit: () => void;
};

function ThreadRoot(props: ThreadRootProps): React.JSX.Element {
  const { exit } = useApp();

  return (
    <ThreadScreen
      threadId={props.threadId}
      loadThread={props.loadThread}
      regenerateDraft={props.regenerateDraft}
      markDone={props.markDone}
      saveDraft={props.saveDraft}
      onBack={() => {
        props.onExit();
        exit();
      }}
    />
  );
}

export async function renderThreadRich(input: ThreadRichInput): Promise<void> {
  await new Promise<void>((resolve) => {
    const instance = render(
      <ThreadRoot
        threadId={input.threadId}
        loadThread={input.loadThread}
        regenerateDraft={input.regenerateDraft}
        markDone={input.markDone}
        saveDraft={input.saveDraft}
        onExit={resolve}
      />,
      {
        exitOnCtrlC: true,
      },
    );

    void instance.waitUntilExit().then(() => {
      resolve();
    });
  });
}
