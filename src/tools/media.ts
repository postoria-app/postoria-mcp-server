import { z } from 'zod';
import { PostoriaClient } from '../postoria/client.js';
import { callTool } from './common.js';
import { mediaIdSchema, workspaceIdSchema } from './schemas.js';

export function registerMediaTools(server: any, client: PostoriaClient) {
  server.tool(
    'create_media_upload',
    'Create a direct media upload in Postoria and return a signed upload URL. Upload the file to the returned URL, then call complete_media_upload.',
    {
      ...workspaceIdSchema,
      name: z.string().min(1).describe('Original file name, for example image.png or video.mp4.'),
      content_type: z
        .string()
        .min(1)
        .describe('MIME content type, for example image/png or video/mp4.'),
    },
    async ({
      workspace_id,
      name,
      content_type,
    }: {
      workspace_id: number;
      name: string;
      content_type: string;
    }) => callTool(() => client.createMediaUpload(workspace_id, { name, content_type })),
  );

  server.tool(
    'complete_media_upload',
    'Mark a previously created Postoria media upload as complete after the file has been uploaded to the signed URL.',
    {
      ...workspaceIdSchema,
      ...mediaIdSchema,
    },
    async ({ workspace_id, media_id }: { workspace_id: number; media_id: number }) =>
      callTool(() => client.completeMediaUpload(workspace_id, media_id)),
  );

  server.tool(
    'import_media_from_url',
    'Import media into Postoria from a public URL.',
    {
      ...workspaceIdSchema,
      url: z.string().url().describe('Publicly accessible media URL to import.'),
    },
    async ({ workspace_id, url }: { workspace_id: number; url: string }) =>
      callTool(() => client.importMediaFromUrl(workspace_id, { url })),
  );

  server.tool(
    'get_media',
    'Get the processing status and details for a Postoria media item.',
    {
      ...workspaceIdSchema,
      ...mediaIdSchema,
    },
    async ({ workspace_id, media_id }: { workspace_id: number; media_id: number }) =>
      callTool(() => client.getMedia(workspace_id, media_id)),
  );
}
