import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { getPostoriaBearerToken, runWithPostoriaBearerToken } from '../auth/requestAuth.js';
import { exchangeToken, TokenExchangeError } from '../auth/tokenExchange.js';
import { createPostoriaMcpServer } from '../server.js';

const MCP_SESSION_ID_HEADER = 'mcp-session-id';
const DEFAULT_SESSION_MAX_AGE_MS = 1000 * 60 * 60;
const POSTORIA_API_KEY_PREFIX = 'pst_live_';
const DEFAULT_RESOURCE_NAME = 'Postoria MCP Server';

type SessionState = {
  transport: StreamableHTTPServerTransport;
  server: ReturnType<typeof createPostoriaMcpServer>;
  createdAt: number;
};

export async function runHttpServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);
  const mcpPath = process.env.MCP_PATH || '/mcp';
  const apiBaseUrl = process.env.POSTORIA_API_BASE_URL;
  const allowedOrigins = parseCsv(process.env.ALLOWED_ORIGINS);
  const metadataPath = getProtectedResourceMetadataPath(mcpPath);
  const sessions = new Map<string, SessionState>();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get(metadataPath, (req, res) => {
    const authorizationServer = process.env.OAUTH_AUTHORIZATION_SERVER;
    if (!authorizationServer) {
      res.status(404).json({ error: 'OAuth protected resource metadata is not configured.' });
      return;
    }

    const scopes = parseCsv(process.env.OAUTH_SCOPES);
    const metadata: Record<string, unknown> = {
      resource: getProtectedResourceUrl(req, mcpPath),
      resource_name: process.env.OAUTH_RESOURCE_NAME || DEFAULT_RESOURCE_NAME,
      authorization_servers: [authorizationServer],
      bearer_methods_supported: ['header'],
    };

    if (scopes.length > 0) {
      metadata.scopes_supported = scopes;
    }

    res.status(200).json(metadata);
  });

  app.use((req, res, next) => {
    if (!isAllowedOrigin(req, allowedOrigins)) {
      res.status(403).json({ error: 'Origin is not allowed.' });
      return;
    }

    next();
  });

  app.post(mcpPath, async (req, res) => {
    try {
      const publicApiBearerToken = await resolvePublicApiBearerToken(req);
      const sessionId = getHeader(req, MCP_SESSION_ID_HEADER);

      if (sessionId) {
        const state = sessions.get(sessionId);
        if (!state) {
          res.status(404).json({
            jsonrpc: '2.0',
            error: {
              code: -32001,
              message: 'MCP session not found.',
            },
            id: null,
          });
          return;
        }

        await runWithPostoriaBearerToken(publicApiBearerToken, () =>
          state.transport.handleRequest(req, res, req.body),
        );
        return;
      }

      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Missing MCP session ID. Initialize a new session first.',
          },
          id: null,
        });
        return;
      }

      const server = createPostoriaMcpServer({
        bearerTokenProvider: getPostoriaBearerToken,
        apiBaseUrl,
      });
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (initializedSessionId: string) => {
          sessions.set(initializedSessionId, {
            transport,
            server,
            createdAt: Date.now(),
          });
        },
      });

      transport.onclose = () => {
        const initializedSessionId = transport.sessionId;
        if (initializedSessionId) {
          sessions.delete(initializedSessionId);
        }
      };

      await server.connect(transport);
      await runWithPostoriaBearerToken(publicApiBearerToken, () =>
        transport.handleRequest(req, res, req.body),
      );
    } catch (error) {
      handleHttpError(req, res, error, (req.body as any)?.id ?? null);
    }
  });

  app.get(mcpPath, async (req, res) => {
    try {
      const publicApiBearerToken = await resolvePublicApiBearerToken(req);
      const sessionId = getHeader(req, MCP_SESSION_ID_HEADER);
      if (!sessionId) {
        res.status(400).json({ error: 'MCP session ID is required.' });
        return;
      }

      const state = sessions.get(sessionId);
      if (!state) {
        res.status(404).json({ error: 'MCP session not found.' });
        return;
      }

      await runWithPostoriaBearerToken(publicApiBearerToken, () =>
        state.transport.handleRequest(req, res),
      );
    } catch (error) {
      handleHttpError(req, res, error);
    }
  });

  app.delete(mcpPath, async (req, res) => {
    try {
      const publicApiBearerToken = await resolvePublicApiBearerToken(req);
      const sessionId = getHeader(req, MCP_SESSION_ID_HEADER);
      if (!sessionId) {
        res.status(400).json({ error: 'MCP session ID is required.' });
        return;
      }

      const state = sessions.get(sessionId);
      if (!state) {
        res.status(404).json({ error: 'MCP session not found.' });
        return;
      }

      await runWithPostoriaBearerToken(publicApiBearerToken, () =>
        state.transport.handleRequest(req, res),
      );
      sessions.delete(sessionId);
    } catch (error) {
      handleHttpError(req, res, error);
    }
  });

  const cleanup = setInterval(
    () => {
      const maxAgeMs = Number(process.env.MCP_SESSION_MAX_AGE_MS || DEFAULT_SESSION_MAX_AGE_MS);
      const now = Date.now();

      for (const [sessionId, state] of sessions.entries()) {
        if (now - state.createdAt > maxAgeMs) {
          void state.transport.close();
          sessions.delete(sessionId);
        }
      }
    },
    1000 * 60 * 15,
  );
  cleanup.unref();

  app.listen(port, () => {
    console.error(`Postoria MCP server listening on http://0.0.0.0:${port}${mcpPath}`);
  });
}

async function resolvePublicApiBearerToken(req: Request) {
  const bearerToken = extractBearerToken(req);
  if (!bearerToken) {
    throw new HttpAuthError(401, 'Authorization header with Bearer token is required.');
  }

  if (bearerToken.startsWith(POSTORIA_API_KEY_PREFIX)) {
    return bearerToken;
  }

  return exchangeToken({ subjectToken: bearerToken });
}

function extractBearerToken(req: Request) {
  const authorization = getHeader(req, 'authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice('bearer '.length).trim();
  }

  return undefined;
}

function getHeader(req: Request, name: string) {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseCsv(value: string | undefined) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAllowedOrigin(req: Request, allowedOrigins: string[]) {
  if (allowedOrigins.length === 0) {
    return true;
  }

  const origin = getHeader(req, 'origin');
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

function getProtectedResourceMetadataPath(mcpPath: string) {
  const normalizedMcpPath = mcpPath.startsWith('/') ? mcpPath : `/${mcpPath}`;
  if (normalizedMcpPath === '/') {
    return '/.well-known/oauth-protected-resource';
  }

  return `/.well-known/oauth-protected-resource${normalizedMcpPath}`;
}

function getProtectedResourceUrl(req: Request, mcpPath: string) {
  const configuredResourceUrl =
    process.env.OAUTH_PROTECTED_RESOURCE_URL || process.env.MCP_PUBLIC_URL;
  if (configuredResourceUrl) {
    return configuredResourceUrl;
  }

  const host =
    getHeader(req, 'x-forwarded-host') ||
    getHeader(req, 'host') ||
    `localhost:${process.env.PORT || 3000}`;
  const proto = getHeader(req, 'x-forwarded-proto') || req.protocol || 'http';
  const normalizedMcpPath = mcpPath.startsWith('/') ? mcpPath : `/${mcpPath}`;
  return `${proto}://${host}${normalizedMcpPath}`;
}

function getProtectedResourceMetadataUrl(req: Request, mcpPath: string) {
  const configuredMetadataUrl = process.env.OAUTH_PROTECTED_RESOURCE_METADATA_URL;
  if (configuredMetadataUrl) {
    return configuredMetadataUrl;
  }

  const host =
    getHeader(req, 'x-forwarded-host') ||
    getHeader(req, 'host') ||
    `localhost:${process.env.PORT || 3000}`;
  const proto = getHeader(req, 'x-forwarded-proto') || req.protocol || 'http';
  return `${proto}://${host}${getProtectedResourceMetadataPath(mcpPath)}`;
}

function setWwwAuthenticateHeader(req: Request, res: Response) {
  const metadataUrl = getProtectedResourceMetadataUrl(req, process.env.MCP_PATH || '/mcp');
  res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${metadataUrl}"`);
}

class HttpAuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpAuthError';
    this.status = status;
  }
}

function handleHttpError(req: Request, res: Response, error: unknown, jsonRpcId: unknown = null) {
  if (res.headersSent) {
    return;
  }

  if (error instanceof HttpAuthError || error instanceof TokenExchangeError) {
    if (error.status === 401) {
      setWwwAuthenticateHeader(req, res);
    }

    res.status(error.status).json({
      jsonrpc: '2.0',
      error: {
        code: error.status === 403 ? -32003 : -32002,
        message: error.message,
      },
      id: jsonRpcId,
    });
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  res.status(500).json({
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message,
    },
    id: null,
  });
}
