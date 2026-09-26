# ADR 0005: CI workflow kept in a visible folder

- **Status:** Accepted
- **Date:** 2026-09-26
- **Spec reference:** §46 (GitHub Actions)

## Context

GitHub Actions only runs workflows from `.github/workflows/`. The team's working rules say output files must never be stored in hidden (dot-prefixed) folders.

## Decision

The workflow lives at `infrastructure/ci/github-actions-ci.yml`. Enabling it is a deliberate, one-line action by a maintainer:

```bash
mkdir -p .github/workflows && cp infrastructure/ci/github-actions-ci.yml .github/workflows/ci.yml
```

## Consequences

- CI does **not** run until someone copies the file. The workflow's header comment says so.
- If the team makes an exception for `.github/`, move the file and delete this copy, so the two don't drift apart.
