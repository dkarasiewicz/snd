import { useInput, Key } from 'ink';

type KeyBinding = {
  id: string;
  match: (input: string, key: Key) => boolean;
  handler: () => void;
  enabled?: boolean;
};

export function useKeymap(bindings: KeyBinding[]): void {
  useInput((input, key) => {
    for (const binding of bindings) {
      if (binding.enabled === false) {
        continue;
      }

      if (binding.match(input, key)) {
        binding.handler();
        return;
      }
    }
  });
}

export function matchInputKey(target: string): (input: string, key: Key) => boolean {
  return (input) => input === target;
}

export function matchEnter(input: string, key: Key): boolean {
  return key.return || input === '\r';
}

export function matchEscape(_input: string, key: Key): boolean {
  return key.escape;
}

export function matchUp(_input: string, key: Key): boolean {
  return key.upArrow;
}

export function matchDown(_input: string, key: Key): boolean {
  return key.downArrow;
}
