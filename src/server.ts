import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PostoriaClient } from './postoria/client.js';
import { registerMediaTools } from './tools/media.js';
import { registerPostTools } from './tools/posts.js';
import { registerWorkspaceTools } from './tools/workspaces.js';

const require = createRequire(import.meta.url);

const packageJson = require('../package.json') as {
  name?: string;
  version?: string;
};

const packageName = packageJson.name ?? '@postoria/mcp-server';
const packageVersion = packageJson.version ?? '0.0.0';

export type CreatePostoriaMcpServerOptions = {
  apiKey: string;
  apiBaseUrl?: string;
};

export function createPostoriaMcpServer(options: CreatePostoriaMcpServerOptions) {
  const server = new McpServer({
    name: 'postoria-mcp-server',
    version: packageVersion,
  });

  const client = new PostoriaClient({
    apiKey: options.apiKey,
    baseUrl: options.apiBaseUrl,
    userAgent: `${packageName}/${packageVersion}`,
  });

  registerWorkspaceTools(server, client);
  registerMediaTools(server, client);
  registerPostTools(server, client);

  server.resource('postoria_api_info', 'postoria://api-info', async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(
          {
            name: 'Postoria Public API',
            base_url:
              options.apiBaseUrl ||
              process.env.POSTORIA_API_BASE_URL ||
              'https://api.postoria.io/v1',
            docs_url: 'https://api.postoria.io/v1/docs/',
            openapi_url: 'https://api.postoria.io/v1/openapi.json',
            authentication: 'Authorization: Bearer <postoria_api_key>',
            supported_transports: ['stdio', 'streamable_http'],
          },
          null,
          2,
        ),
      },
    ],
  }));

  server.prompt(
    'postoria_create_social_post',
    'Guide an AI agent to create a Postoria post safely using workspace and social account discovery first.',
    {},
    async () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Use Postoria tools to create a social post. First call list_workspaces, then list_social_accounts for the chosen workspace. Ask the user to confirm workspace, social accounts, caption, media, and publish timing before calling publish_post_now, schedule_post, add_post_to_queue, or delete_post.',
          },
        },
      ],
    }),
  );

  return server;
}
