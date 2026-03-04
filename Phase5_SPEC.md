## Architectural Decisions: Google Drive MCP Integration

**Hybrid Read/Write Approach:** Google Drive access uses a split strategy. Read and search operations go through the official `mcp/gdrive` Docker MCP server. Since that server does not support file uploads, the `/gdrive-save` skill uses a custom Node.js script (`gdrive-save.js`) that calls the `googleapis` package directly.

**Local CLI Authentication:** Docker containers cannot open a browser for the standard OAuth2 flow, so authorization is handled manually via `gdrive-auth/auth.js`. Running this script prints a URL, the user authorizes in a browser, pastes the redirect URL back, and `token.json` is written to disk before the container starts.

**Volume Mounting for Token Sharing:** The `gdrive-auth/` directory (containing `credentials.json` and `token.json`) is mounted into the Docker container as a volume. The paths are passed via environment variables `GDRIVE_OAUTH_PATH` and `GDRIVE_CREDENTIALS_PATH`, giving the isolated container access to locally-generated credentials.

**Secret Management Policy:** `credentials.json` and `token.json` are listed in `.gitignore` and never committed. Only the token-acquisition logic (`auth.js`) is tracked in the repository.
