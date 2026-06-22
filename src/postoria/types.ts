export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type PublicApiListResponse<T> = {
  data: T[];
  pagination?: {
    has_more: boolean;
    next_cursor: string | null;
  };
};

export type Workspace = {
  id: number;
  name: string;
  timezone: string;
};

export type Network =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'google_business_profile'
  | 'threads'
  | 'x'
  | 'pinterest'
  | 'youtube'
  | 'tiktok'
  | 'telegram'
  | 'bluesky'
  | 'reddit'
  | 'tumblr';

export type SocialAccount = {
  id: number;
  name: string;
  description: string | null;
  network: Network;
  url: string;
};

export type Queue = {
  id: number;
  name: string;
  is_paused: boolean;
};

export type MediaStatus = 'waiting_for_upload' | 'processing' | 'ready' | 'failed' | string;

export type CreateMediaUploadRequest = {
  name: string;
  content_type: string;
};

export type MediaUploadResponse = {
  id: number;
  status: MediaStatus;
  upload: {
    url: string;
  };
};

export type ImportMediaRequest = {
  url: string;
};

export type Media = {
  id: number;
  status: MediaStatus;
  file_id: number | null;
  error_code: string | null;
  error_message: string | null;
};

export type PublishMode = 'publish_now' | 'schedule' | 'queue';
export type ContentType = 'text' | 'image' | 'video' | 'carousel' | 'link' | string;

export type RepostSettings = {
  frequency?: string | null;
  until?: string | null;
};

export type YouTubeOptions = {
  title?: string | null;
  visibility?: string | null;
  category?: string | null;
  made_for_kids?: boolean | null;
  video_language?: string | null;
  recording_date?: string | null;
  tags?: string[];
};

export type TikTokOptions = {
  who_can_watch?: string | null;
  allow_comments?: boolean | null;
  allow_duet?: boolean | null;
  allow_stitch?: boolean | null;
  disclose_post_content?: boolean | null;
  your_brand?: boolean | null;
  branded_content?: boolean | null;
  photo_title?: string | null;
  auto_add_music?: boolean | null;
};

export type CreatePostRequest = {
  publish_mode: PublishMode;
  social_account_ids: number[];
  content_type?: ContentType | null;
  media_ids?: number[];
  caption?: string | null;
  link_url?: string | null;
  first_comment?: string | null;
  comment_delay?: number | null;
  scheduled_time?: string | null;
  queue_id?: number | null;
  repost?: RepostSettings | null;
  youtube?: YouTubeOptions | null;
  tiktok?: TikTokOptions | null;
};

export type Post = {
  id: number;
  status: string;
  results: Array<{
    account_id: number;
    link_to_post: string | null;
    error: string | null;
  }>;
};

export type PublicApiErrorResponse = {
  error: {
    code: string;
    message: string;
    param?: string | null;
    details?: unknown;
    request_id?: string;
  };
};
