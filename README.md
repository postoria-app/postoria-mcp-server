# Postoria MCP Server

Postoria MCP Server connects MCP-compatible AI clients to Postoria.

Use it to list workspaces, find social accounts and queues, upload or import media, publish posts, schedule posts, add posts to queues, check post status, and delete posts.

## Package

```bash
npx -y @postoria/mcp-server
```

## Features

- Local `stdio` transport for desktop and IDE MCP clients
- Streamable HTTP transport for hosted MCP clients
- Works with Postoria Public API keys
- Supports Postoria workspaces, social accounts, queues, media, and posts
- MCP Registry metadata in `server.json`

## Supported tools

| Tool                     | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `list_workspaces`        | List available Postoria workspaces                    |
| `list_social_accounts`   | List social accounts in a workspace                   |
| `list_queues`            | List queues in a workspace                            |
| `create_media_upload`    | Create a signed media upload URL                      |
| `complete_media_upload`  | Complete a media upload after raw bytes are uploaded  |
| `upload_media_from_file` | Upload a local file from stdio clients                |
| `import_media_from_url`  | Import media from a public URL                        |
| `get_media`              | Get media status and details                          |
| `publish_post_now`       | Publish a post immediately                            |
| `schedule_post`          | Schedule a post for a specific time                   |
| `add_post_to_queue`      | Add a post to a Postoria queue                        |
| `list_posts`             | List posts in a workspace with filters and pagination |
| `get_post`               | Get post status and details                           |
| `delete_post`            | Delete a post created through the Public API          |

`upload_media_from_file` is available only in local `stdio` mode. It is not exposed through the hosted Streamable HTTP endpoint.

## Requirements

- Node.js 20+
- A Postoria Public API key for local stdio usage
- A Postoria Public API key or OAuth access token for hosted Streamable HTTP usage

## Local stdio usage

Add this to your MCP client configuration:

```json
{
  "mcpServers": {
    "postoria": {
      "command": "npx",
      "args": ["-y", "@postoria/mcp-server"],
      "env": {
        "POSTORIA_API_KEY": "pst_live_your_api_key_here"
      }
    }
  }
}
```

## Hosted Streamable HTTP usage

Hosted endpoint:

```text
https://mcp.postoria.io/mcp
```

Send an `Authorization` header on every hosted MCP request. Postoria Public API keys are forwarded
to the Public API directly:

```http
Authorization: Bearer pst_live_your_api_key_here
```

OAuth access tokens accepted by the hosted endpoint are exchanged server-side before calling the
Postoria Public API.

OAuth-capable clients discover the authorization server from the protected resource metadata:

```text
https://mcp.postoria.io/.well-known/oauth-protected-resource/mcp
```

## Media upload options

Use `import_media_from_url` when the media is already available through a public URL.

Use `create_media_upload` when the client will upload raw file bytes to the returned signed upload URL. After the raw bytes are uploaded with `PUT`, call `complete_media_upload`.

Use `upload_media_from_file` in local `stdio` mode when the media file exists on the same machine where the MCP server is running.

## Social network options

`publish_post_now`, `schedule_post`, and `add_post_to_queue` accept optional settings grouped by social network:

- `instagram`: Trial Reel publishing and automatic sharing.
- `youtube`: video title, visibility, category, audience, language, recording date, and tags.
- `tiktok`: visibility, interactions, content disclosure, photo title, and automatic music for photos.

Each object requires a selected account of that network and applies only to that network. Tool input schemas list the supported fields; MCP currently exposes a subset of the Public API options.

For example, include these settings when creating a video post for Instagram, YouTube, and TikTok:

```json
{
  "instagram": {
    "publish_as_trial_reel": true,
    "auto_share_if_performs_well": false
  },
  "youtube": {
    "title": "Video title"
  },
  "tiktok": {
    "allow_comments": true
  }
}
```

Use `content_type: "video"` with one video for this example. Instagram Trial Reels require an eligible account and a single video. `publish_as_trial_reel` defaults to `false`. For Trial Reels, `auto_share_if_performs_well: true` lets Instagram decide whether to share with followers based on views in the first 72 hours; `false` or omitted keeps sharing manual in Instagram.

Post creation responses, `get_post`, and `list_posts` include the saved Instagram Trial Reel settings when returned by the API, including explicit `false` values. They describe the publishing settings, not the live distribution status on Instagram.

## Run from source

```bash
npm install
npm run build
```

Run in local stdio mode:

```bash
POSTORIA_API_KEY=pst_live_your_api_key_here npm run dev:stdio
```

Run in local HTTP mode:

```bash
npm run dev:http
```

HTTP mode requires the MCP client to send `Authorization: Bearer <token>` on every `/mcp` request.
`POSTORIA_API_KEY` is used by local stdio mode only.

Local HTTP endpoint:

```text
http://localhost:3000/mcp
```

Health check:

```text
http://localhost:3000/health
```

## MCP Registry

`server.json` includes distribution metadata for:

- remote Streamable HTTP endpoint: `https://mcp.postoria.io/mcp`
- local npm stdio package: `@postoria/mcp-server`

## Security notes

- The MCP server does not store Postoria API keys.
- Local stdio mode reads `POSTORIA_API_KEY` from the environment.
- Hosted HTTP mode requires `Authorization: Bearer <token>` on every MCP request.
- Hosted HTTP mode exchanges OAuth access tokens server-side and does not store refresh tokens.
- `POSTORIA_API_KEY` is used by local stdio mode only.
- `delete_post` is destructive and should only be called after user confirmation.

## Development

```bash
npm install
npm run typecheck
npm run build
npm run format:check
```
