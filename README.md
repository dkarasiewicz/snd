# snd

`snd` is a local CLI agent that polls IMAP and drafts replies for new threads.

It is intentionally brief and autonomous:
- grabs new msgs/thrds
- decides if reply is needed
- drafts concise reply text
- never sends mail (you send from your email client)

## Features

- IMAP polling (`run --once` or daemon loop)
- Gmail OAuth2 + generic IMAP password auth
- BYO LLM token + model (`openai-compatible` API)
- Optional DeepAgents integration (auto-detected via `deepagents` package)
- Hard rules (`ignore sender/domain`, per-pattern vibe/style)
- Local memory for thread context and learned user edits
- Ink TUI for `run`, `inbox`, and `thread` with `--ui auto|rich|plain`
- Interactive thread editing in CLI (`thread <id> --interactive`) remains available in plain mode
- Latest-first defaults: inbox shows 20 threads and bootstrap sync focuses on recent threads
- Email body cleanup (quoted-reply/signature trimming)
- Retry/backoff on IMAP and LLM network calls

## Open Source

- License: [MIT](./LICENSE)
- Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Release process: [RELEASE.md](./RELEASE.md)

## Install

One-line installer (for your public repo URL):

```bash
curl -fsSL https://raw.githubusercontent.com/dkarasiewicz/snd/main/scripts/install.sh | sh
```

Update an existing installation:

```bash
snd update
```

For local dev:

```bash
pnpm install
pnpm build
pnpm dev -- --help
```

## Quickstart

1. Bootstrap local state:

```bash
snd init --wizard
```
Wizard can also store LLM token and IMAP credential/refresh token so first sync is ready immediately.

2. If needed, edit config at `~/.snd/config.yaml` (see `examples/config.yaml`).

3. If you skipped token/credentials in the wizard, store them:

```bash
snd auth --llm-token
```

4. Authenticate IMAP account:

- Gmail OAuth:

```bash
snd auth --account main --gmail
```

Default flow opens browser and captures callback on localhost automatically.

- Generic IMAP password/app-password:

```bash
snd auth --account main --imap-password
```

5. Run one sync:

```bash
snd run --once
```

6. List threads needing reply:

```bash
snd inbox
```

7. Inspect/edit a thread:

```bash
snd thread <threadId>
snd thread <threadId> --interactive
snd thread <threadId> --regen --instruction "shorter, ask one question"
```

## Core Commands

- `snd init`
- `snd auth --llm-token`
- `snd auth --account <id> --gmail`
- `snd auth --account <id> --imap-password`
- `snd run [--once] [--interval 300] [--account <id>] [--ui auto|rich|plain] [--verbose]`
- `snd inbox [--limit 20] [--ui auto|rich|plain]`
- `snd thread <threadId> [--interactive|--regen|--done] [--ui auto|rich|plain]`
- `snd rule --list`
- `snd rule --add-ignore-sender noreply@foo.com`
- `snd rule --add-ignore-domain foo.com`
- `snd rule --add-style "@vip.com:ultra concise, direct"`
- `snd config --set-poll 180`
- `snd memory --set-user "writing:tight, clear, action-oriented"`
- `snd memory --list-user`
- `snd update`

Advanced update options:
- `snd update --repo-url <git-url>`
- `snd update --install-dir <path> --bin-dir <path>`
- `snd update --script-url <raw-install-script-url-or-local-path>`

Advanced Gmail OAuth options:
- `snd auth --account <id> --gmail --no-local-server`
- `snd auth --account <id> --gmail --listen-timeout 180`

## TUI Shortcuts

Default UI mode is `auto` (rich in TTY, plain in non-interactive shells/CI).

`snd inbox` (rich):
- `j/k` or `↑/↓`: move selection
- `enter`: open selected thread
- `r`: regenerate selected draft
- `d`: mark selected thread done
- `R`: refresh inbox
- `?`: toggle help
- `q`: quit

`snd thread <id>` (rich):
- `e`: edit draft inline
- `ctrl+s`: save draft (while editing)
- `esc`: cancel editing
- `r`: regenerate draft
- `d`: mark done
- `?`: toggle help
- `q`: back/quit

`snd run` (rich daemon):
- `q`: stop daemon and quit

## Security Model

- All data stays local in `~/.snd/`.
- Credentials are stored in macOS Keychain when available.
- Fallback secret store is AES-GCM encrypted with a local master key.

## Storage

- Config: `~/.snd/config.yaml`
- DB: `~/.snd/snd.db`
- Secret fallback: `~/.snd/secrets.enc.json`

## DeepAgents

`snd` attempts to use DeepAgents if:
- `llm.useDeepAgents: true` in config, and
- `deepagents` package is installed

Install DeepAgents stack:

```bash
pnpm add deepagents langchain @langchain/core
```

If DeepAgents is unavailable or errors, `snd` falls back to direct chat-completions API.

## Notes

- v0.1 targets `INBOX` polling.
- Current draft heuristics are intentionally simple and meant to be iterated.
- Sending emails is intentionally out of scope.

## CI/CD

- CI workflow (`.github/workflows/ci.yml`) runs build + tests on pushes and PRs.
- Release workflow (`.github/workflows/release.yml`) runs on `v*` tags and publishes GitHub Release artifacts.
