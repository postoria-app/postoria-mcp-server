# Security

Do not open public issues for vulnerabilities. Email security concerns to the Postoria maintainers.

## API keys

The MCP server accepts a Postoria Public API key through either:

- `POSTORIA_API_KEY` in local stdio mode
- `Authorization: Bearer <api_key>` on every hosted Streamable HTTP request

Hosted Streamable HTTP mode can also accept OAuth access tokens. The hosted MCP server exchanges
those tokens server-side before calling the Postoria Public API and does not store API keys, OAuth
access tokens, or refresh tokens in MCP session state.

OAuth-capable MCP clients discover the configured authorization server through the hosted
protected resource metadata endpoint.

Never log or commit API keys.
