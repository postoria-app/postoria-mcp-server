import { basename, extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { PostoriaClient } from '../postoria/client.js';
import { callFormattedTool, errorResult, textResult } from './common.js';
import {
  formatLocalFileMissing,
  formatLocalUploadFailed,
  formatLocalUploadSuccess,
  formatMedia,
  formatMediaImportCreated,
  formatMediaUploadCompleted,
  formatMediaUploadCreated,
} from './formatters.js';
import { mediaIdSchema, workspaceIdSchema } from './schemas.js';

export type RegisterMediaToolsOptions = {
  enableLocalFileUpload?: boolean;
};

export function registerMediaTools(
  server: any,
  client: PostoriaClient,
  options: RegisterMediaToolsOptions = {},
) {
  server.tool(
    'create_media_upload',
    'Create a media upload slot and signed upload URL. This tool does not upload file bytes; upload raw bytes to the returned URL with PUT, then call complete_media_upload.',
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
    }) =>
      callFormattedTool(
        () => client.createMediaUpload(workspace_id, { name, content_type }),
        (upload) =>
          formatMediaUploadCreated(upload, {
            workspaceId: workspace_id,
            filename: name,
            contentType: content_type,
          }),
      ),
  );

  server.tool(
    'complete_media_upload',
    'Complete a media upload after the raw file bytes have been uploaded to the signed upload URL.',
    {
      ...workspaceIdSchema,
      ...mediaIdSchema,
    },
    async ({ workspace_id, media_id }: { workspace_id: number; media_id: number }) =>
      callFormattedTool(
        () => client.completeMediaUpload(workspace_id, media_id),
        (media) => formatMediaUploadCompleted(media, workspace_id),
      ),
  );

  if (options.enableLocalFileUpload) {
    server.tool(
      'upload_media_from_file',
      'Upload a local file from the machine running this MCP server. Local stdio mode only.',
      {
        ...workspaceIdSchema,
        file_path: z
          .string()
          .min(1)
          .describe('Path to a local file on the machine running the MCP server.'),
        content_type: z
          .string()
          .min(1)
          .optional()
          .describe('Optional MIME content type. If omitted, it is inferred from the filename.'),
        filename: z
          .string()
          .min(1)
          .optional()
          .describe('Optional filename to use in Postoria. Defaults to the local file basename.'),
      },
      async ({
        workspace_id,
        file_path,
        content_type,
        filename,
      }: {
        workspace_id: number;
        file_path: string;
        content_type?: string;
        filename?: string;
      }) => uploadMediaFromFile(client, workspace_id, file_path, content_type, filename),
    );
  }

  server.tool(
    'import_media_from_url',
    'Import media into Postoria from a public URL.',
    {
      ...workspaceIdSchema,
      url: z.string().url().describe('Publicly accessible media URL to import.'),
    },
    async ({ workspace_id, url }: { workspace_id: number; url: string }) =>
      callFormattedTool(
        () => client.importMediaFromUrl(workspace_id, { url }),
        (media) => formatMediaImportCreated(media, { workspaceId: workspace_id, sourceUrl: url }),
      ),
  );

  server.tool(
    'get_media',
    'Get the processing status and details for a Postoria media item.',
    {
      ...workspaceIdSchema,
      ...mediaIdSchema,
    },
    async ({ workspace_id, media_id }: { workspace_id: number; media_id: number }) =>
      callFormattedTool(
        () => client.getMedia(workspace_id, media_id),
        (media) => formatMedia(media, workspace_id),
      ),
  );
}

async function uploadMediaFromFile(
  client: PostoriaClient,
  workspaceId: number,
  filePath: string,
  contentType: string | undefined,
  filename: string | undefined,
) {
  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch {
    return textResult(formatLocalFileMissing(filePath), true);
  }

  const finalFilename = filename || basename(filePath);
  const finalContentType = contentType || inferContentType(finalFilename);

  try {
    const upload = await client.createMediaUpload(workspaceId, {
      name: finalFilename,
      content_type: finalContentType,
    });

    try {
      await client.uploadToSignedUrl(upload.upload.url, data);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return textResult(formatLocalUploadFailed(upload, workspaceId, reason), true);
    }

    const media = await client.completeMediaUpload(workspaceId, upload.id);
    return textResult(
      formatLocalUploadSuccess(
        media,
        {
          workspaceId,
          filename: finalFilename,
          contentType: finalContentType,
        },
        filePath,
      ),
      media.status.toLowerCase() === 'failed',
    );
  } catch (error) {
    return errorResult(error);
  }
}

function inferContentType(filename: string) {
  const extension = extname(filename).toLowerCase();

  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    default:
      return 'application/octet-stream';
  }
}
