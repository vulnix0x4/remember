# Contributing to Remember

Thanks for helping make personal AI software more grounded, private, and honest.

## Before opening a pull request

1. Open or reference an issue for substantial product changes.
2. Keep private data, credentials, resource identifiers, and signing files out of commits.
3. Preserve the product contract: claims must be source-grounded, personal interpretations must be labeled as hypotheses, and original links must remain available.
4. Add or update tests for behavioral changes.
5. Run `pnpm check`. For iOS changes, also run `./scripts/ci-ios.sh`.

## Development

Use Node.js 22+ and pnpm 11+.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

The default local stack uses deterministic analysis and an isolated development user. Never add real API keys to fixtures, screenshots, tests, `.env.example`, or `.dev.vars.example`.

## Pull requests

- Keep changes focused and describe the user-facing outcome.
- Include screenshots for visual changes, with private content removed.
- Call out migrations, new permissions, provider data flows, or privacy implications.
- Use clear commit messages written in the imperative mood.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
