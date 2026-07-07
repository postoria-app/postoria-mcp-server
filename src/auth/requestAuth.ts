import { AsyncLocalStorage } from 'node:async_hooks';

const authStorage = new AsyncLocalStorage<string>();

export function runWithPostoriaBearerToken<T>(bearerToken: string, callback: () => T): T {
  return authStorage.run(bearerToken, callback);
}

export function getPostoriaBearerToken() {
  const bearerToken = authStorage.getStore();
  if (!bearerToken) {
    throw new Error('Authorization is required for this MCP request.');
  }

  return bearerToken;
}
