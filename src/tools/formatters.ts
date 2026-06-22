import type {
  Media,
  MediaStatus,
  MediaUploadResponse,
  Post,
  PublicApiListResponse,
  Queue,
  SocialAccount,
  Workspace,
} from '../postoria/types.js';

export type MediaUploadContext = {
  workspaceId: number;
  filename: string;
  contentType: string;
};

export type MediaImportContext = {
  workspaceId: number;
  sourceUrl: string;
};

export type PostContext = {
  workspaceId: number;
  socialAccountIds?: number[];
  mediaIds?: number[];
  scheduledTime?: string | null;
  queueId?: number | null;
  caption?: string | null;
};

export function formatWorkspaces(response: PublicApiListResponse<Workspace>) {
  if (response.data.length === 0) {
    return 'No Postoria workspaces found for this API key.';
  }

  return [
    'Postoria workspaces:',
    '',
    response.data.map(formatWorkspace).join('\n\n'),
    paginationNote(response.pagination),
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatSocialAccounts(
  workspaceId: number,
  response: PublicApiListResponse<SocialAccount>,
) {
  if (response.data.length === 0) {
    return `No social accounts found in workspace ${workspaceId}.`;
  }

  return [
    `Social accounts in workspace ${workspaceId}:`,
    '',
    response.data.map(formatSocialAccount).join('\n\n'),
    'Use the account ID when publishing, scheduling, or queueing posts.',
    paginationNote(response.pagination),
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatQueues(workspaceId: number, response: PublicApiListResponse<Queue>) {
  if (response.data.length === 0) {
    return `No queues found in workspace ${workspaceId}.`;
  }

  return [
    `Queues in workspace ${workspaceId}:`,
    '',
    response.data.map(formatQueue).join('\n\n'),
    'Use the queue ID when adding posts to a queue.',
    paginationNote(response.pagination),
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatMediaUploadCreated(upload: MediaUploadResponse, context: MediaUploadContext) {
  return [
    'Media upload created.',
    '',
    'Media',
    `ID: ${upload.id}`,
    `Status: ${upload.status}`,
    `Workspace ID: ${context.workspaceId}`,
    `Filename: ${context.filename}`,
    `Content type: ${context.contentType}`,
    '',
    'Upload',
    'Method: PUT',
    `URL: ${upload.upload.url}`,
    '',
    'Next step:',
    'Upload the raw file bytes to the URL above using PUT.',
    '',
    'Example:',
    'curl -X PUT "<upload_url>" \\',
    '  --data-binary "@file.jpg"',
    '',
    `After the upload succeeds, call complete_media_upload with media ID ${upload.id}.`,
  ].join('\n');
}

export function formatMediaUploadCompleted(media: Media, workspaceId: number) {
  if (isFailedMediaStatus(media.status)) {
    return formatMediaFailure('Media processing failed.', media, workspaceId);
  }

  return [
    'Media upload completed.',
    '',
    formatMediaCard(media, workspaceId),
    '',
    'Use this media ID when creating, scheduling, or queueing a media post.',
  ].join('\n');
}

export function formatMediaImportCreated(media: Media, context: MediaImportContext) {
  if (isFailedMediaStatus(media.status)) {
    return formatMediaFailure('Media import failed.', media, context.workspaceId);
  }

  return [
    'Media import created.',
    '',
    formatMediaCard(media, context.workspaceId),
    `Source URL: ${context.sourceUrl}`,
    '',
    `Next step: call get_media with media ID ${media.id} to check whether processing has completed.`,
  ].join('\n');
}

export function formatMedia(media: Media, workspaceId: number) {
  if (isFailedMediaStatus(media.status)) {
    return formatMediaFailure('Media found, but processing failed.', media, workspaceId);
  }

  return ['Media found.', '', formatMediaCard(media, workspaceId)].join('\n');
}

export function formatPostCreated(post: Post, action: string, context: PostContext) {
  return [
    `${action}.`,
    '',
    formatPostCard(post, context),
    '',
    'Use the post ID when checking post status or deleting/canceling this post.',
  ].join('\n');
}

export function formatPost(post: Post, workspaceId: number) {
  return ['Post found.', '', formatPostCard(post, { workspaceId })].join('\n');
}

export function formatLocalFileMissing(filePath: string) {
  return [
    'Media upload failed.',
    '',
    'File path:',
    filePath,
    '',
    'Reason:',
    'The file does not exist or cannot be read by the local MCP server process.',
  ].join('\n');
}

export function formatLocalUploadFailed(
  upload: MediaUploadResponse,
  workspaceId: number,
  reason: string,
) {
  return [
    'Media upload failed.',
    '',
    'Media',
    `ID: ${upload.id}`,
    `Status: ${upload.status}`,
    `Workspace ID: ${workspaceId}`,
    '',
    'Reason:',
    reason,
  ].join('\n');
}

export function formatLocalUploadSuccess(
  media: Media,
  context: MediaUploadContext,
  filePath: string,
) {
  if (isFailedMediaStatus(media.status)) {
    return formatMediaFailure('Media upload failed.', media, context.workspaceId);
  }

  return [
    'Media uploaded successfully.',
    '',
    formatMediaCard(media, context.workspaceId),
    `Filename: ${context.filename}`,
    `Content type: ${context.contentType}`,
    `Source file: ${filePath}`,
    '',
    'Use this media ID when creating, scheduling, or queueing a media post.',
  ].join('\n');
}

function formatWorkspace(workspace: Workspace) {
  return [
    'Workspace',
    `ID: ${workspace.id}`,
    `Name: ${workspace.name}`,
    `Timezone: ${workspace.timezone}`,
  ].join('\n');
}

function formatSocialAccount(account: SocialAccount) {
  return [
    'Social account',
    `ID: ${account.id}`,
    `Name: ${account.name}`,
    `Network: ${account.network}`,
    `URL: ${account.url}`,
  ].join('\n');
}

function formatQueue(queue: Queue) {
  return ['Queue', `ID: ${queue.id}`, `Name: ${queue.name}`, `Paused: ${queue.is_paused}`].join(
    '\n',
  );
}

function formatMediaCard(media: Media, workspaceId: number) {
  return [
    'Media',
    `ID: ${media.id}`,
    `Status: ${media.status}`,
    `Workspace ID: ${workspaceId}`,
    `File ID: ${media.file_id ?? 'none'}`,
    ...(media.error_code ? [`Error code: ${media.error_code}`] : []),
    ...(media.error_message ? [`Error message: ${media.error_message}`] : []),
  ].join('\n');
}

function formatMediaFailure(title: string, media: Media, workspaceId: number) {
  const fallbackMessage =
    'Make sure the raw file bytes were uploaded to the signed upload URL before calling complete_media_upload.';

  return [
    title,
    '',
    formatMediaCard(media, workspaceId),
    ...(media.error_message ? [] : ['Error message: ' + fallbackMessage]),
  ].join('\n');
}

function formatPostCard(post: Post, context: PostContext) {
  const resultLines = post.results.flatMap((result, index) => [
    `Result ${index + 1}`,
    `Account ID: ${result.account_id}`,
    `Link: ${result.link_to_post ?? 'none'}`,
    `Error: ${result.error ?? 'none'}`,
  ]);

  return [
    'Post',
    `ID: ${post.id}`,
    `Status: ${post.status}`,
    `Workspace ID: ${context.workspaceId}`,
    ...(context.socialAccountIds
      ? [`Social account IDs: ${context.socialAccountIds.join(', ')}`]
      : []),
    ...(context.mediaIds && context.mediaIds.length > 0
      ? [`Media IDs: ${context.mediaIds.join(', ')}`]
      : []),
    ...(context.queueId ? [`Queue ID: ${context.queueId}`] : []),
    ...(context.scheduledTime ? [`Scheduled time: ${context.scheduledTime}`] : []),
    ...(context.caption ? [`Caption: ${context.caption}`] : []),
    ...(resultLines.length > 0 ? ['', 'Results', ...resultLines] : []),
  ].join('\n');
}

function paginationNote(pagination?: PublicApiListResponse<unknown>['pagination']) {
  if (!pagination?.has_more) {
    return undefined;
  }

  return `More results are available. Next cursor: ${pagination.next_cursor ?? 'none'}`;
}

function isFailedMediaStatus(status: MediaStatus) {
  return status.toLowerCase() === 'failed';
}
