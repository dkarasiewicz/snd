# Changelog

All notable changes to `snd` will be documented in this file.

The format is based on Keep a Changelog,
and this project adheres to Semantic Versioning.

## [Unreleased]

## [0.1.2] - 2026-02-10

### Added
- Localhost OAuth callback flow for Gmail auth in `snd auth --account <id> --gmail`, with manual fallback and timeout controls.
- UI mode controls (`--ui auto|rich|plain`) for `run`, `inbox`, and `thread`.
- New config defaults for `sync.bootstrapThreadLimit`, `sync.bootstrapMessageWindow`, `inbox.defaultLimit`, and `ui.mode`.

### Changed
- `inbox` now defaults to 20 threads via config (`inbox.defaultLimit`).
- Sync bootstrap now focuses on recent threads on first run (empty sync state).

### Fixed
- IMAP transport debug logs are now disabled by default to avoid noisy terminal output.
- `run` output is now clean and informative without animated bird frames.

## [0.1.1] - 2026-02-10

### Fixed
- `scripts/install.sh` now works with `curl ... | sh` by using POSIX-compatible shell syntax.
- Node version detection in installer no longer fails due to escaped quote parsing.
- Installer now creates a launcher script that executes from install dir, so runtime deps resolve correctly.
- CLI bootstrap now imports `reflect-metadata`; decorator metadata emit is enabled for Nest Commander runtime stability.
- Config parsing now tolerates legacy `null` values for optional fields (`defaultAccountId`, `llm.baseUrl`, `account.oauth`) and normalizes them.
- Default generated config no longer emits `defaultAccountId: null`, avoiding startup failures in `snd init --wizard`.

### Added
- `snd update` command to fetch and execute the installer for in-place CLI upgrades.

## [0.1.0] - 2026-02-10

### Added
- TypeScript CLI built with Nest Commander for local IMAP polling and draft generation.
- `snd init --wizard` onboarding for mailbox + model setup and optional secret storage.
- Gmail OAuth2 and generic IMAP password auth flows.
- Local SQLite storage for accounts, threads, messages, drafts, rules, and memory.
- Rule engine for ignore sender/domain and style/vibe customization.
- Draft generation pipeline with OpenAI-compatible API and optional DeepAgents adapter.
- Interactive thread editing loop (`--interactive`) with single-line and multi-line edit modes.
- Animated bird status indicator for idle/sync/thinking/done/error states.
- Retry/backoff for IMAP and LLM network operations.
- Email body normalization (quoted-reply and signature cleanup).
- Open-source governance docs: License, Contributing, Code of Conduct, Security Policy.
- GitHub issue/PR templates.

### Security
- Local credential handling via macOS Keychain with encrypted fallback store.
- Local-first processing model; email sending intentionally out of scope.
