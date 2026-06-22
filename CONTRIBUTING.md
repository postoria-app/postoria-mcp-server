# Contributing

Thanks for your interest in improving the Postoria MCP Server.

## Development

```bash
npm install
npm run typecheck
npm run build
npm run format:check
```

## Pull requests

Please keep changes focused, documented, and covered by TypeScript type checks.

When adding or changing MCP tools, update:

- `src/tools/*`
- `src/tools/schemas.ts`
- `src/postoria/types.ts` when request or response types change
- `README.md` if the public usage changes
- `server.json` if distribution metadata changes
