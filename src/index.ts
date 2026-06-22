#!/usr/bin/env node
import { runHttpServer } from './transports/http.js';
import { runStdioServer } from './transports/stdio.js';

const mode = process.argv[2] || process.env.MCP_TRANSPORT || 'stdio';

try {
  if (mode === 'stdio') {
    await runStdioServer();
  } else if (mode === 'http' || mode === 'streamable-http') {
    await runHttpServer();
  } else {
    throw new Error(`Unsupported transport "${mode}". Use "stdio" or "http".`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
