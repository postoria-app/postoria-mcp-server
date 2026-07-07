import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createPostoriaMcpServer } from '../server.js';

export async function runStdioServer() {
  const apiKey = process.env.POSTORIA_API_KEY;
  if (!apiKey) {
    throw new Error('POSTORIA_API_KEY is required for stdio mode.');
  }

  const server = createPostoriaMcpServer({
    bearerToken: apiKey,
    apiBaseUrl: process.env.POSTORIA_API_BASE_URL,
    enableLocalFileUpload: true,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
