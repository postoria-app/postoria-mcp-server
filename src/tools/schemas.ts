import { z } from 'zod';

export const workspaceIdSchema = {
  workspace_id: z.number().int().positive().describe('Postoria workspace ID.'),
};

export const mediaIdSchema = {
  media_id: z.number().int().positive().describe('Postoria media ID.'),
};

export const postIdSchema = {
  post_id: z.number().int().positive().describe('Postoria post ID.'),
};

export const socialAccountIdsSchema = z
  .array(z.number().int().positive())
  .min(1)
  .describe('One or more Postoria social account IDs to publish to.');

export const mediaIdsSchema = z
  .array(z.number().int().positive())
  .default([])
  .describe('Media IDs already created or imported through the Postoria Public API.');

export const publishModeSchema = z
  .enum(['publish_now', 'schedule', 'queue'])
  .describe('How Postoria should publish this post.');

export const contentTypeSchema = z
  .enum(['text', 'image', 'video', 'carousel', 'link'])
  .optional()
  .describe('Optional content type. If omitted, Postoria will infer it from media/link/caption.');

export const repostSchema = z
  .object({
    frequency: z
      .string()
      .optional()
      .describe(
        'Repeat frequency in Postoria API snake_case enum format, for example daily or weekly.',
      ),
    until: z
      .string()
      .datetime()
      .optional()
      .describe('Optional UTC ISO 8601 time until which Postoria should repeat the post.'),
  })
  .optional()
  .describe('Optional repost/recycle settings.');

export const youtubeSchema = z
  .object({
    title: z.string().optional().describe('YouTube video title.'),
    visibility: z
      .string()
      .optional()
      .describe('YouTube visibility in Postoria API snake_case enum format.'),
    category: z.string().optional().describe('YouTube category.'),
    made_for_kids: z.boolean().optional().describe('Whether the YouTube video is made for kids.'),
    video_language: z.string().optional().describe('YouTube video language code.'),
    recording_date: z
      .string()
      .datetime()
      .optional()
      .describe('Optional UTC ISO 8601 YouTube recording date.'),
    tags: z.array(z.string()).optional().describe('YouTube tags.'),
  })
  .optional()
  .describe('Optional YouTube-specific settings.');

export const tiktokSchema = z
  .object({
    who_can_watch: z
      .string()
      .optional()
      .describe('TikTok visibility in Postoria API snake_case enum format.'),
    allow_comments: z.boolean().optional(),
    allow_duet: z.boolean().optional(),
    allow_stitch: z.boolean().optional(),
    disclose_post_content: z.boolean().optional(),
    your_brand: z.boolean().optional(),
    branded_content: z.boolean().optional(),
    photo_title: z.string().optional().describe('Optional TikTok photo/carousel title.'),
    auto_add_music: z
      .boolean()
      .optional()
      .describe('Whether TikTok should automatically add music to photo/carousel posts.'),
  })
  .optional()
  .describe('Optional TikTok-specific settings.');

export const createPostBaseSchema = {
  ...workspaceIdSchema,
  social_account_ids: socialAccountIdsSchema,
  content_type: contentTypeSchema,
  media_ids: mediaIdsSchema,
  caption: z.string().optional().describe('Post caption text.'),
  link_url: z.string().url().optional().describe('Optional link URL for link posts.'),
  first_comment: z.string().optional().describe('Optional first comment.'),
  comment_delay: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Optional first comment delay, in minutes.'),
  repost: repostSchema,
  youtube: youtubeSchema,
  tiktok: tiktokSchema,
};
