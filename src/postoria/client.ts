import { PostoriaApiError } from './errors.js';
import type {
  CreateMediaUploadRequest,
  CreatePostRequest,
  ImportMediaRequest,
  ListPostsRequest,
  Media,
  MediaUploadResponse,
  Post,
  PublicApiErrorResponse,
  PublicApiListResponse,
  Queue,
  SocialAccount,
  Workspace,
} from './types.js';

export type PostoriaClientOptions = {
  bearerToken?: string;
  bearerTokenProvider?: () => string | Promise<string>;
  baseUrl?: string;
  userAgent?: string;
};

export class PostoriaClient {
  private readonly bearerTokenProvider: () => string | Promise<string>;
  private readonly baseUrl: string;
  private readonly userAgent: string;

  constructor(options: PostoriaClientOptions) {
    if (options.bearerTokenProvider) {
      this.bearerTokenProvider = options.bearerTokenProvider;
    } else if (options.bearerToken && options.bearerToken.trim().length > 0) {
      const bearerToken = options.bearerToken.trim();
      this.bearerTokenProvider = () => bearerToken;
    } else {
      throw new Error('Postoria bearer token is required.');
    }

    this.baseUrl = normalizeBaseUrl(
      options.baseUrl || process.env.POSTORIA_API_BASE_URL || 'https://api.postoria.io/v1',
    );
    this.userAgent = options.userAgent || '@postoria/mcp-server';
  }

  listWorkspaces() {
    return this.request<PublicApiListResponse<Workspace>>('/workspaces');
  }

  listSocialAccounts(workspaceId: number) {
    return this.request<PublicApiListResponse<SocialAccount>>(
      `/workspaces/${workspaceId}/social-accounts`,
    );
  }

  listQueues(workspaceId: number) {
    return this.request<PublicApiListResponse<Queue>>(`/workspaces/${workspaceId}/queues`);
  }

  createMediaUpload(workspaceId: number, body: CreateMediaUploadRequest) {
    return this.request<MediaUploadResponse>(`/workspaces/${workspaceId}/media/uploads`, {
      method: 'POST',
      body,
    });
  }

  completeMediaUpload(workspaceId: number, mediaId: number) {
    return this.request<Media>(`/workspaces/${workspaceId}/media/${mediaId}/complete`, {
      method: 'POST',
    });
  }

  importMediaFromUrl(workspaceId: number, body: ImportMediaRequest) {
    return this.request<Media>(`/workspaces/${workspaceId}/media/imports`, {
      method: 'POST',
      body,
    });
  }

  getMedia(workspaceId: number, mediaId: number) {
    return this.request<Media>(`/workspaces/${workspaceId}/media/${mediaId}`);
  }

  async uploadToSignedUrl(uploadUrl: string, data: Uint8Array | Buffer) {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: data as unknown as BodyInit,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Signed upload failed with HTTP ${response.status}${text ? `: ${text}` : ''}`,
      );
    }
  }

  createPost(workspaceId: number, body: CreatePostRequest) {
    return this.request<Post>(`/workspaces/${workspaceId}/posts`, {
      method: 'POST',
      body,
    });
  }

  listPosts(workspaceId: number, params: ListPostsRequest = {}) {
    const query = buildQueryString(params);
    return this.request<PublicApiListResponse<Post>>(`/workspaces/${workspaceId}/posts${query}`);
  }

  getPost(workspaceId: number, postId: number) {
    return this.request<Post>(`/workspaces/${workspaceId}/posts/${postId}`);
  }

  deletePost(workspaceId: number, postId: number) {
    return this.request<void>(`/workspaces/${workspaceId}/posts/${postId}`, {
      method: 'DELETE',
    });
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const bearerToken = await this.bearerTokenProvider();
    if (!bearerToken || bearerToken.trim().length === 0) {
      throw new Error('Postoria bearer token is required.');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        authorization: `Bearer ${bearerToken.trim()}`,
        accept: 'application/json',
        'user-agent': this.userAgent,
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!response.ok) {
      let parsed: PublicApiErrorResponse | undefined;
      try {
        parsed = text ? (JSON.parse(text) as PublicApiErrorResponse) : undefined;
      } catch {
        parsed = undefined;
      }

      throw new PostoriaApiError(response.status, text, parsed);
    }

    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed.endsWith('/v1')) {
    return `${trimmed}/v1`;
  }

  return trimmed;
}

function buildQueryString(params: ListPostsRequest) {
  const query = new URLSearchParams();

  appendRepeated(query, 'account_ids', params.account_ids);
  appendScalar(query, 'queue_id', params.queue_id);
  appendScalar(query, 'status', params.status);
  appendRepeated(query, 'networks', params.networks);
  appendScalar(query, 'date_from', params.date_from);
  appendScalar(query, 'date_to', params.date_to);
  appendScalar(query, 'limit', params.limit);
  appendScalar(query, 'cursor', params.cursor);

  const value = query.toString();
  return value ? `?${value}` : '';
}

function appendScalar(query: URLSearchParams, name: string, value: string | number | undefined) {
  if (value !== undefined) {
    query.append(name, String(value));
  }
}

function appendRepeated(
  query: URLSearchParams,
  name: string,
  values: Array<string | number> | undefined,
) {
  for (const value of values ?? []) {
    query.append(name, String(value));
  }
}
