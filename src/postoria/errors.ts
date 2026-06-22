import type { PublicApiErrorResponse } from './types.js';

export class PostoriaApiError extends Error {
  public readonly status: number;
  public readonly requestId?: string;
  public readonly code?: string;
  public readonly param?: string | null;
  public readonly details?: unknown;

  constructor(status: number, responseText: string, parsed?: PublicApiErrorResponse) {
    const message =
      parsed?.error?.message || responseText || `Postoria API request failed (${status})`;
    super(message);
    this.name = 'PostoriaApiError';
    this.status = status;
    this.requestId = parsed?.error?.request_id;
    this.code = parsed?.error?.code;
    this.param = parsed?.error?.param;
    this.details = parsed?.error?.details;
  }

  toJSON() {
    return {
      name: this.name,
      status: this.status,
      code: this.code,
      message: this.message,
      param: this.param,
      details: this.details,
      request_id: this.requestId,
    };
  }
}

export function formatUnknownError(error: unknown) {
  if (error instanceof PostoriaApiError) {
    return JSON.stringify(error.toJSON(), null, 2);
  }

  if (error instanceof Error) {
    return JSON.stringify(
      {
        name: error.name,
        message: error.message,
      },
      null,
      2,
    );
  }

  return JSON.stringify({ message: String(error) }, null, 2);
}
