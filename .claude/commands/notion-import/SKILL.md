---
name: notion-import
description: Reads a local .txt file and creates or updates a Notion page with its content. Auto-invoke when user asks to import, upload, or push a local file to Notion.
argument-hint: "<file-path> [--update <notion-page-id-or-url>] [--parent <parent-page-id-or-url>]"
---

## Required Tools

- Read
- Bash
- AskUserQuestion
- mcp__notion__API-retrieve-a-page
- mcp__notion__API-post-page
- mcp__notion__API-patch-page
- mcp__notion__API-patch-block-children
- mcp__notion__API-get-block-children
- mcp__notion__API-delete-a-block

## Input Parsing

Parse `$ARGUMENTS` for:
- `file-path`: required positional argument — path to the local `.txt` file
- `--update <id-or-url>`: optional flag indicating an existing Notion page to overwrite
- `--parent <id-or-url>`: optional flag specifying the parent page under which to create a new page

If `file-path` is missing, ask:
```
AskUserQuestion: "Please provide the path to the local .txt file to import."
```

Extract page ID from any Notion URL using the same rule as notion-export: take the trailing 32 hex characters from the last path segment and normalize to UUID format.

## Step 1 — Read Local File

Use the Read tool to load the full contents of `file-path`.

Derive the page title from the filename:
- Strip the directory path and `.txt` extension
- Replace underscores and hyphens with spaces
- Title-case the result

Example: `my_project_notes.txt` → `My Project Notes`

## Step 2 — Route: Create or Update

If `--update` was provided → go to **Update Flow**.

If neither `--update` nor `--parent` was provided, ask:
```
AskUserQuestion: "Do you want to create a new Notion page or update an existing one?"
Options:
  - "Create new page"
  - "Update existing page"
```

If the user chooses update, ask for the target page URL or ID.
If the user chooses create, optionally ask for a parent page URL or ID (they may skip to create at the workspace root).

## Step 3 — Text-to-Blocks Conversion

Parse the file content line by line into Notion block objects.

| Line pattern | Block type |
|---|---|
| Starts with `# ` | `heading_1` |
| Starts with `## ` | `heading_2` |
| Starts with `### ` | `heading_3` |
| Starts with `- ` | `bulleted_list_item` |
| Matches `^\d+\. ` | `numbered_list_item` |
| Starts with `[x] ` | `to_do` with `checked: true` |
| Starts with `[ ] ` | `to_do` with `checked: false` |
| Starts with `> ` | `quote` |
| Equals `---` | `divider` |
| Empty line | skip (acts as separator) |
| Any other text | `paragraph` |

For code blocks delimited by triple backticks, collect all lines between the fences into a single `code` block, setting `language` from the opening fence if present.

Build each block as:
```json
{
  "object": "block",
  "type": "<block-type>",
  "<block-type>": {
    "rich_text": [{ "type": "text", "text": { "content": "<line-text>" } }]
  }
}
```

For `to_do`, also include `"checked": true/false` inside the type object.
For `divider`, omit `rich_text` entirely.
For `code`, use `"rich_text"` for content and `"language"` for the language string.

Notion's API accepts a maximum of 100 blocks per request. Split the block array into chunks of 100.

## Update Flow

1. Call `mcp__notion__API-retrieve-a-page` with the target page ID to confirm it exists.
2. Call `mcp__notion__API-get-block-children` to list all existing blocks.
3. Delete each existing block by calling `mcp__notion__API-delete-a-block` for each block ID.
4. Proceed to **Write Blocks**.

## Create Flow

Build the page creation payload:
```json
{
  "parent": { "page_id": "<parent-id>" },
  "properties": {
    "title": {
      "title": [{ "type": "text", "text": { "content": "<derived-title>" } }]
    }
  }
}
```

If no parent was given, use `{ "workspace": true }` as the parent object.

Call `mcp__notion__API-post-page` with the payload. Capture the new page's `id` from the response.

Proceed to **Write Blocks** using the new page ID.

## Write Blocks

For each chunk of up to 100 blocks, call `mcp__notion__API-patch-block-children` with:
```json
{
  "block_id": "<page-id>",
  "children": [ ...chunk ]
}
```

## Step 4 — Report

For a new page, output:
```
Created Notion page "<title>" — https://notion.so/<page-id-no-dashes>
```

For an update, output:
```
Updated Notion page "<title>" — https://notion.so/<page-id-no-dashes>
```
