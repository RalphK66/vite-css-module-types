# Contributing

## Setup

```bash
nvm use
npm install
```

## Scripts

```bash
npm run build       # Build with tsup + tsc declarations
npm run typecheck   # Type-check without emitting
npm run lint        # Lint with oxlint
npm run fmt         # Format with oxfmt
npm run fmt:check   # Check formatting
npm test            # Run tests with vitest
```

## Making changes

1. Fork the repo and create a branch
2. Edit source in `src/`
3. Add tests &mdash; unit tests in `src/__tests__/`, integration tests in `test/`
4. Run `npm run fmt && npm run lint && npm run typecheck && npm test`
5. Open a pull request
