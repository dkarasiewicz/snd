# Contributing to snd

Thanks for contributing to `snd`.

## Quick Start

1. Fork and clone:

```bash
git clone https://github.com/<you>/snd.git
cd snd
```

2. Install dependencies:

```bash
pnpm install
```

3. Run checks before opening PR:

```bash
pnpm build
pnpm test
```

## Development Flow

1. Create a branch from `main`.
2. Keep changes focused and small.
3. Add or update tests for behavior changes.
4. Update docs when user-facing behavior changes.
5. Open a PR with a clear summary and test evidence.

## Pull Request Guidelines

- Use descriptive commit messages.
- Mention any config migrations or security implications.
- Include CLI examples for changed commands.
- Keep PRs reviewable (prefer incremental PRs).

## What We Prioritize

- Reliability for IMAP sync and draft generation.
- Local-first privacy and secure token handling.
- Minimal, clear UX.
- Backward-compatible config evolution.

## Reporting Bugs

Please include:
- OS + Node version
- `snd` version
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs/errors (redact secrets)

## Security Issues

Do not open public issues for security vulnerabilities.
Use the process in `SECURITY.md`.
