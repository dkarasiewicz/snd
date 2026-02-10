# Changelog

All notable changes to `snd` will be documented in this file.

The format is based on Keep a Changelog,
and this project adheres to Semantic Versioning.

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
