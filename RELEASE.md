# Release Process

This project uses SemVer tags (`vX.Y.Z`) and GitHub Releases.

## Maintainer Checklist

1. Ensure clean branch:

```bash
git status
```

2. Run release checks:

```bash
pnpm install
pnpm build
pnpm test
```

3. Update version and changelog:

```bash
pnpm version patch --no-git-tag-version
# or: pnpm version minor --no-git-tag-version
```

Then update `CHANGELOG.md` with the new version/date/notes.

4. Commit release:

```bash
git add -A
git commit -m "release: vX.Y.Z"
```

5. Tag and push:

```bash
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

6. Verify GitHub Release workflow completed successfully.

## First Push Setup

If remote is not configured yet:

```bash
git remote add origin git@github.com:dkarasiewicz/snd.git
# or HTTPS:
# git remote add origin https://github.com/dkarasiewicz/snd.git
```
