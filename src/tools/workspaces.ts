import { z } from 'zod';
import { PostoriaClient } from '../postoria/client.js';
import { callTool } from './common.js';

export function registerWorkspaceTools(server: any, client: PostoriaClient) {
  server.tool(
    'list_workspaces',
    'List Postoria workspaces available to the API key.',
    {},
    async () => callTool(() => client.listWorkspaces()),
  );

  server.tool(
    'list_social_accounts',
    'List social accounts in a Postoria workspace.',
    {
      workspace_id: z.number().int().positive().describe('Postoria workspace ID.'),
    },
    async ({ workspace_id }: { workspace_id: number }) =>
      callTool(() => client.listSocialAccounts(workspace_id)),
  );

  server.tool(
    'list_queues',
    'List publishing queues in a Postoria workspace.',
    {
      workspace_id: z.number().int().positive().describe('Postoria workspace ID.'),
    },
    async ({ workspace_id }: { workspace_id: number }) =>
      callTool(() => client.listQueues(workspace_id)),
  );
}
