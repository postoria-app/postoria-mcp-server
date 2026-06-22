import { z } from 'zod';
import { PostoriaClient } from '../postoria/client.js';
import type { CreatePostRequest } from '../postoria/types.js';
import { callEmptyTool, callTool } from './common.js';
import { createPostBaseSchema, postIdSchema, workspaceIdSchema } from './schemas.js';

type CreatePostArgs = Omit<CreatePostRequest, 'publish_mode'> & {
  workspace_id: number;
  publish_mode: CreatePostRequest['publish_mode'];
};

export function registerPostTools(server: any, client: PostoriaClient) {
  server.tool(
    'publish_post_now',
    'Create and publish a Postoria post immediately.',
    createPostBaseSchema,
    async (args: Omit<CreatePostArgs, 'publish_mode'>) =>
      callTool(() =>
        client.createPost(
          args.workspace_id,
          buildPostBody({ ...args, publish_mode: 'publish_now' }),
        ),
      ),
  );

  server.tool(
    'schedule_post',
    'Create a Postoria post scheduled for a specific UTC date-time.',
    {
      ...createPostBaseSchema,
      scheduled_time: z.string().datetime().describe('UTC ISO 8601 date-time.'),
    },
    async (args: Omit<CreatePostArgs, 'publish_mode'> & { scheduled_time: string }) =>
      callTool(() =>
        client.createPost(args.workspace_id, buildPostBody({ ...args, publish_mode: 'schedule' })),
      ),
  );

  server.tool(
    'add_post_to_queue',
    'Create a Postoria post and add it to a publishing queue.',
    {
      ...createPostBaseSchema,
      queue_id: z.number().int().positive().describe('Postoria queue ID.'),
    },
    async (args: Omit<CreatePostArgs, 'publish_mode'> & { queue_id: number }) =>
      callTool(() =>
        client.createPost(args.workspace_id, buildPostBody({ ...args, publish_mode: 'queue' })),
      ),
  );

  server.tool(
    'get_post',
    'Get status and publishing results for a Postoria post.',
    {
      ...workspaceIdSchema,
      ...postIdSchema,
    },
    async ({ workspace_id, post_id }: { workspace_id: number; post_id: number }) =>
      callTool(() => client.getPost(workspace_id, post_id)),
  );

  server.tool(
    'delete_post',
    'Delete/cancel a Postoria post. This is destructive and should only be called after user confirmation.',
    {
      ...workspaceIdSchema,
      ...postIdSchema,
    },
    async ({ workspace_id, post_id }: { workspace_id: number; post_id: number }) =>
      callEmptyTool(
        () => client.deletePost(workspace_id, post_id),
        `Post ${post_id} was deleted from workspace ${workspace_id}.`,
      ),
  );
}

function buildPostBody(args: CreatePostArgs): CreatePostRequest {
  const {
    workspace_id: _workspaceId,
    publish_mode,
    social_account_ids,
    content_type,
    media_ids,
    caption,
    link_url,
    first_comment,
    comment_delay,
    scheduled_time,
    queue_id,
    repost,
    youtube,
    tiktok,
  } = args;

  return removeUndefined({
    publish_mode,
    social_account_ids,
    content_type,
    media_ids,
    caption,
    link_url,
    first_comment,
    comment_delay,
    scheduled_time,
    queue_id,
    repost,
    youtube,
    tiktok,
  });
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
