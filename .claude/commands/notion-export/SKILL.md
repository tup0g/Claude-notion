---
name: notion-export
description: Reads a Notion page by URL or ID via MCP and saves its content as a .txt file. The filename is derived from the page title. Auto-invoke when user asks to export, save, or download a Notion page.
argument-hint: "<notion-url-or-page-id> [output-directory]"
---

## Required Tools

- Read
- Write
- Bash
- AskUserQuestion
- mcp__notion__API-retrieve-a-page
- mcp__notion__API-get-block-children

## Input Parsing

The argument `$ARGUMENTS` may be:
- A full Notion URL: `https://www.notion.so/...` or `https://notion.so/...`
- A page ID in UUID format with or without dashes
- A page ID followed by an optional output directory path

Extract the page ID:
- From a URL: take the last path segment, remove query string and fragment, then extract the trailing 32 hex characters (the UUID portion after the last `-`)
- From a bare ID: use as-is, normalizing to the format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` if dashes are missing

If no input is provided, ask the user:
```
AskUserQuestion: "Please provide the Notion page URL or page ID to export."
```

If no output directory is given, use the current working directory.

## Step 1 — Retrieve Page Metadata

Call `mcp__notion__API-retrieve-a-page` with `{ "page_id": "<extracted-id>" }`.

From the response, extract the page title:
- Look in `properties.title.title[*].plain_text` or `properties.Name.title[*].plain_text`
- Join all plain_text values with no separator
- If the title is empty or missing, use `notion-page-<page-id>` as the fallback title

## Step 2 — Derive Filename

Sanitize the page title for use as a filename:
- Replace any character that is not alphanumeric, space, hyphen, or underscore with a space
- Collapse consecutive spaces into a single space
- Trim leading and trailing spaces
- Replace spaces with underscores
- Convert to lowercase
- Append `.txt`

Example: `"My Project Notes!"` → `my_project_notes.txt`

## Step 3 — Retrieve Page Blocks

Call `mcp__notion__API-get-block-children` with `{ "block_id": "<extracted-id>" }`.

For each block in `results`, convert to plain text using the rules in Step 4. If a block has `has_children: true`, recursively call `mcp__notion__API-get-block-children` with that block's `id` and indent the child text by two spaces.

## Step 4 — Block-to-Text Conversion Rules

Extract `plain_text` from the `rich_text` array of each block's type object (e.g., `paragraph.rich_text`, `heading_1.rich_text`, etc.) by joining all `plain_text` values.

| Block type | Formatting |
|---|---|
| `heading_1` | Prepend `# ` |
| `heading_2` | Prepend `## ` |
| `heading_3` | Prepend `### ` |
| `bulleted_list_item` | Prepend `- ` |
| `numbered_list_item` | Prepend `N. ` where N is the item's 1-based position among consecutive numbered items |
| `to_do` | Prepend `[x] ` if checked, `[ ] ` if unchecked |
| `quote` | Prepend `> ` |
| `code` | Wrap in triple backticks with language if present |
| `divider` | Output `---` |
| `callout` | Prepend the icon (if any) followed by a space, then the text |
| `paragraph` or any other type | Output text as-is |

Separate top-level blocks with a single newline. Add a blank line after heading blocks.

## Step 5 — Write Output File

Construct the full output path: `<output-directory>/<sanitized-filename>.txt`

Write the assembled text to that path using the Write tool.

## Step 6 — Report

Output a single confirmation line:
```
Exported "<page-title>" → <full-output-path>
```
