import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigCommand } from '../src/cli/commands/config.command.js';

describe('ConfigCommand --reset-account', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resets local account state and preserves credentials', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const command = new ConfigCommand(
      {
        load: () => ({
          accounts: [{ id: 'main' }],
        }),
      } as never,
      {
        resetAccountData: () => ({
          messagesDeleted: 12,
          threadsDeleted: 4,
          draftsDeleted: 3,
          memoryNotesDeleted: 2,
          syncStateDeleted: 1,
          accountRowDeleted: 1,
          agentStoreDeleted: 5,
        }),
      } as never,
    );

    await command.run([], { resetAccount: 'main' });

    const output = writeSpy.mock.calls.map((call) => String(call[0])).join('');
    expect(output).toContain('account main local state reset');
    expect(output).toContain('credentials preserved');
    expect(output).toContain('messages=12');
  });

  it('fails when account does not exist in config', async () => {
    const command = new ConfigCommand(
      {
        load: () => ({
          accounts: [{ id: 'main' }],
        }),
      } as never,
      {
        resetAccountData: () => ({
          messagesDeleted: 0,
          threadsDeleted: 0,
          draftsDeleted: 0,
          memoryNotesDeleted: 0,
          syncStateDeleted: 0,
          accountRowDeleted: 0,
          agentStoreDeleted: 0,
        }),
      } as never,
    );

    await expect(command.run([], { resetAccount: 'missing' })).rejects.toThrow('Account missing not found in config');
  });
});
