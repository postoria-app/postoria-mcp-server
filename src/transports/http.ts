import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createPostoriaMcpServer } from '../server.js';

const MCP_SESSION_ID_HEADER = 'mcp-session-id';

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
  const sessions = new Map<string, SessionState>();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
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

        await state.transport.handleRequest(req, res, req.body);
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

      const apiKey = extractApiKey(req);
      if (!apiKey) {
        res.status(401).json({
          jsonrpc: '2.0',
          error: {
            code: -32002,
            message: 'Authorization header with Bearer Postoria API key is required.',
          },
          id: (req.body as any)?.id ?? null,
        });
        return;
      }

      const server = createPostoriaMcpServer({ apiKey, apiBaseUrl });
      let transport: StreamableHTTPServerTransport;

      transport = new StreamableHTTPServerTransport({
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
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  app.get(mcpPath, async (req, res) => {
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

    try {
      await state.transport.handleRequest(req, res);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  app.delete(mcpPath, async (req, res) => {
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

    try {
      await state.transport.handleRequest(req, res);
      sessions.delete(sessionId);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  const cleanup = setInterval(
    () => {
      const maxAgeMs = Number(process.env.MCP_SESSION_MAX_AGE_MS || 1000 * 60 * 60 * 12);
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

function extractApiKey(req: Request) {
  const authorization = getHeader(req, 'authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice('bearer '.length).trim();
  }

  // Useful for local HTTP development. Do not rely on this in hosted production.
  return process.env.POSTORIA_API_KEY || undefined;
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

function handleHttpError(res: Response, error: unknown) {
  if (res.headersSent) {
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
