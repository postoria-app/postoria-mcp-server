import type { z } from 'zod';
import { formatUnknownError } from '../postoria/errors.js';

export function textResult(text: string, isError = false) {
  return {
    ...(isError ? { isError: true } : {}),
    content: [
      {
        type: 'text' as const,
        text,
      },
    ],
  };
}

export function jsonResult(data: unknown) {
  return textResult(JSON.stringify(data, null, 2));
}

export function emptyResult(message: string) {
  return textResult(message);
}

export function errorResult(error: unknown) {
  return textResult(formatUnknownError(error), true);
}

export async function callTool<T>(callback: () => Promise<T>) {
  try {
    return jsonResult(await callback());
  } catch (error) {
    return errorResult(error);
  }
}

export async function callFormattedTool<T>(
  callback: () => Promise<T>,
  formatter: (data: T) => string,
) {
  try {
    return textResult(formatter(await callback()));
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
