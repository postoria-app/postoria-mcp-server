export type TokenExchangeOptions = {
  subjectToken: string;
};

type TokenExchangeResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

export class TokenExchangeError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'TokenExchangeError';
    this.status = status;
  }
}

export async function exchangeToken(options: TokenExchangeOptions) {
  const tokenEndpoint = getRequiredEnv('OAUTH_TOKEN_EXCHANGE_ENDPOINT');
  const clientId = getRequiredEnv('OAUTH_TOKEN_EXCHANGE_CLIENT_ID');
  const clientSecret = getRequiredEnv('OAUTH_TOKEN_EXCHANGE_CLIENT_SECRET');
  const audience = getRequiredEnv('OAUTH_TOKEN_EXCHANGE_AUDIENCE');

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: options.subjectToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    audience,
  });

  let response: Response;
  try {
    response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  } catch {
    throw new TokenExchangeError(502, 'OAuth token exchange failed.');
  }

  const text = await response.text();
  let parsed: TokenExchangeResponse | undefined;
  try {
    parsed = text ? (JSON.parse(text) as TokenExchangeResponse) : undefined;
  } catch {
    parsed = undefined;
  }

  if (!response.ok) {
    throw mapTokenExchangeError(response.status, parsed?.error);
  }

  if (!parsed?.access_token) {
    throw new TokenExchangeError(502, 'Token exchange response did not include an access token.');
  }

  return parsed.access_token;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new TokenExchangeError(500, 'OAuth token exchange is not configured.');
  }

  return value.trim();
}

function mapTokenExchangeError(status: number, error: string | undefined) {
  if (status === 401 || error === 'invalid_grant' || error === 'invalid_token') {
    return new TokenExchangeError(401, 'Invalid OAuth access token.');
  }

  if (
    status === 403 ||
    error === 'access_denied' ||
    error === 'insufficient_scope' ||
    error === 'invalid_scope' ||
    error === 'not_authorized' ||
    error === 'unauthorized_client'
  ) {
    return new TokenExchangeError(403, 'OAuth token exchange is not allowed.');
  }

  if (error === 'invalid_client') {
    return new TokenExchangeError(500, 'OAuth token exchange is not configured.');
  }

  return new TokenExchangeError(502, 'OAuth token exchange failed.');
}
