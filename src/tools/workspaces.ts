import { z } from 'zod';
import { PostoriaClient } from '../postoria/client.js';
import { callFormattedTool } from './common.js';
import { formatQueues, formatSocialAccounts, formatWorkspaces } from './formatters.js';

export function registerWorkspaceTools(server: any, client: PostoriaClient) {
  server.tool(
    'list_workspaces',
    'List Postoria workspaces available to the API key. Returns workspace IDs that should be used in follow-up Postoria tools.',
    {},
    async () => callFormattedTool(() => client.listWorkspaces(), formatWorkspaces),
  );

  server.tool(
    'list_social_accounts',
    'List social accounts in a Postoria workspace. Returns account IDs that should be used when publishing, scheduling, or queueing posts.',
    {
      workspace_id: z.number().int().positive().describe('Postoria workspace ID.'),
    },
    async ({ workspace_id }: { workspace_id: number }) =>
      callFormattedTool(
        () => client.listSocialAccounts(workspace_id),
        (accounts) => formatSocialAccounts(workspace_id, accounts),
      ),
  );

  server.tool(
    'list_queues',
    'List publishing queues in a Postoria workspace. Returns queue IDs that should be used with add_post_to_queue.',
    {
      workspace_id: z.number().int().positive().describe('Postoria workspace ID.'),
    },
    async ({ workspace_id }: { workspace_id: number }) =>
      callFormattedTool(
        () => client.listQueues(workspace_id),
        (queues) => formatQueues(workspace_id, queues),
      ),
  );
}
