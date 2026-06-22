import { z } from 'zod';
import { PostoriaClient } from '../postoria/client.js';
import type { CreatePostRequest } from '../postoria/types.js';
import { callEmptyTool, callFormattedTool } from './common.js';
import { formatPost, formatPostCreated } from './formatters.js';
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
      callFormattedTool(
        () =>
          client.createPost(
            args.workspace_id,
            buildPostBody({ ...args, publish_mode: 'publish_now' }),
          ),
        (post) => formatPostCreated(post, 'Post created for immediate publishing', context(args)),
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
      callFormattedTool(
        () =>
          client.createPost(
            args.workspace_id,
            buildPostBody({ ...args, publish_mode: 'schedule' }),
          ),
        (post) => formatPostCreated(post, 'Post scheduled successfully', context(args)),
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
      callFormattedTool(
        () =>
          client.createPost(args.workspace_id, buildPostBody({ ...args, publish_mode: 'queue' })),
        (post) => formatPostCreated(post, 'Post added to queue successfully', context(args)),
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
      callFormattedTool(
        () => client.getPost(workspace_id, post_id),
        (post) => formatPost(post, workspace_id),
      ),
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
        ['Post deleted.', '', 'Post', `ID: ${post_id}`, `Workspace ID: ${workspace_id}`].join('\n'),
      ),
  );
}

function buildPostBody(args: CreatePostArgs): CreatePostRequest {
  return removeUndefined({
    publish_mode: args.publish_mode,
    social_account_ids: args.social_account_ids,
    content_type: args.content_type,
    media_ids: args.media_ids,
    caption: args.caption,
    link_url: args.link_url,
    first_comment: args.first_comment,
    comment_delay: args.comment_delay,
    scheduled_time: args.scheduled_time,
    queue_id: args.queue_id,
    repost: args.repost,
    youtube: args.youtube,
    tiktok: args.tiktok,
  });
}

function context(args: Omit<CreatePostArgs, 'publish_mode'>) {
  return {
    workspaceId: args.workspace_id,
    socialAccountIds: args.social_account_ids,
    mediaIds: args.media_ids,
    scheduledTime: args.scheduled_time,
    queueId: args.queue_id,
    caption: args.caption,
  };
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
