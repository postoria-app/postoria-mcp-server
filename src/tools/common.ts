import type { z } from 'zod';
import { formatUnknownError } from '../postoria/errors.js';

export function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function emptyResult(message: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: message,
      },
    ],
  };
}

export function errorResult(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: formatUnknownError(error),
      },
    ],
  };
}

export async function callTool<T>(callback: () => Promise<T>) {
  try {
    return jsonResult(await callback());
  } catch (error) {
    return errorResult(error);
  }
}

export async function callEmptyTool(callback: () => Promise<void>, successMessage: string) {
  try {
    await callback();
    return emptyResult(successMessage);
  } catch (error) {
    return errorResult(error);
  }
}

export type InferShape<T extends z.ZodRawShape> = z.infer<z.ZodObject<T>>;
