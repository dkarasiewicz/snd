export type UiMode = 'auto' | 'rich' | 'plain';
export type ResolvedUiMode = 'rich' | 'plain';

export function resolveUiMode(configMode: UiMode | undefined, override: UiMode | undefined): ResolvedUiMode {
  const selected = override ?? configMode ?? 'auto';

  if (selected === 'plain') {
    return 'plain';
  }

  if (selected === 'rich') {
    return 'rich';
  }

  return process.stdout.isTTY ? 'rich' : 'plain';
}
