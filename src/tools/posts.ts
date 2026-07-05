import { z } from 'zod';
import { PostoriaClient } from '../postoria/client.js';
import type { CreatePostRequest, ListPostsRequest } from '../postoria/types.js';
import { callEmptyTool, callFormattedTool } from './common.js';
import { formatPost, formatPostCreated, formatPosts } from './formatters.js';
import { createPostBaseSchema, postIdSchema, workspaceIdSchema } from './schemas.js';

type CreatePostArgs = Omit<CreatePostRequest, 'publish_mode'> & {
  workspace_id: number;
  publish_mode: CreatePostRequest['publish_mode'];
};

type ListPostsArgs = ListPostsRequest & {
  workspace_id: number;
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
    'list_posts',
    'List posts in a Postoria workspace, optionally filtered by accounts, queue, status, networks, UTC date range, and cursor pagination.',
    listPostsSchema,
    async (args: ListPostsArgs) =>
      callFormattedTool(
        () => client.listPosts(args.workspace_id, buildListPostsParams(args)),
        (posts) => formatPosts(args.workspace_id, posts),
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

function buildListPostsParams(args: ListPostsArgs): ListPostsRequest {
  return removeUndefined({
    account_ids: args.account_ids,
    queue_id: args.queue_id,
    status: args.status,
    networks: args.networks,
    date_from: args.date_from,
    date_to: args.date_to,
    limit: args.limit,
    cursor: args.cursor,
  });
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

const listPostsSchema = {
  ...workspaceIdSchema,
  account_ids: z
    .array(z.number().int().positive())
    .optional()
    .describe('Optional social account IDs. Posts matching any selected account are returned.'),
  queue_id: z.number().int().positive().optional().describe('Optional Postoria queue ID.'),
  status: z
    .enum(['draft', 'scheduled', 'in_progress', 'posted', 'queued'])
    .optional()
    .describe('Optional post status filter.'),
  networks: z
    .array(
      z.enum([
        'facebook',
        'instagram',
        'linkedin',
        'google_business_profile',
        'threads',
        'x',
        'pinterest',
        'youtube',
        'tiktok',
        'telegram',
        'bluesky',
        'reddit',
        'tumblr',
      ]),
    )
    .optional()
    .describe('Optional social network filters.'),
  date_from: z
    .string()
    .datetime()
    .optional()
    .describe('Optional UTC ISO 8601 lower bound for scheduled date/time.'),
  date_to: z
    .string()
    .datetime()
    .optional()
    .describe('Optional UTC ISO 8601 upper bound for scheduled date/time.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Number of posts to return. Defaults to 25; maximum is 100.'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor returned by the previous list_posts call.'),
};
