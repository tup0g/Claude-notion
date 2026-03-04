---
name: notion-process
description: Reads a Notion page via MCP, applies an AI transformation (study guide generation — summary, key concepts, and Q&A pairs), and writes the result to a new Notion page. Auto-invoke when user asks to summarize, process, transform, or generate a study guide from a Notion page.
argument-hint: "<source-notion-url-or-id> [--parent <parent-page-id-or-url>]"
---

## Required Tools

- AskUserQuestion
- mcp__notion__API-retrieve-a-page
- mcp__notion__API-get-block-children
- mcp__notion__API-post-page
- mcp__notion__API-patch-block-children

## Transformation: Study Guide Generator

This skill reads any Notion page and transforms it into a structured study guide containing three sections:

1. **Overview** — a concise 2–3 sentence summary of what the page covers and why it matters.
2. **Key Concepts** — every important term, technology, or idea extracted from the content, each written as `Term — one-sentence definition` and formatted as a bulleted list.
3. **Q&A Review** — 5–10 question-and-answer pairs generated from the content, designed to test comprehension. Each pair follows the format `Q: <question>` on one line and `A: <answer>` on the next, separated by a blank line.

This transformation is non-trivial because it requires semantic understanding of the source content, identification of key concepts, reformulation of knowledge as questions, and generation of concise, accurate answers — none of which can be achieved by copying or reformatting alone.

## Notion API Constraints

Internal integrations cannot create workspace-level pages. Every new page requires a `parent.page_id`. Never use `{ "workspace": true }`.

The `mcp__notion__API-patch-block-children` tool only accepts `paragraph` and `bulleted_list_item` block types. All output blocks must use one of these two types.

## Input Parsing

Parse `$ARGUMENTS` for:
- `source`: required — a Notion page URL or page ID (with or without dashes)
- `--parent <id-or-url>`: optional — parent page for the output page

Extract page ID from a URL: take the trailing 32 hex characters from the last path segment and normalize to `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` format.

If no source is provided, ask:
```
AskUserQuestion: "Please provide the source Notion page URL or ID to process."
```

If `--parent` is not provided, ask once:
```
AskUserQuestion: "Provide the parent Notion page URL or ID where the study guide will be created."
```

## Step 1 — Read Source Page

Call `mcp__notion__API-retrieve-a-page` with the extracted source page ID.

Extract the page title from `properties.title.title[*].plain_text` (join all values). If empty, use `notion-page-<id>` as the fallback.

The output page title will be: `Study Guide: <source-title>`

## Step 2 — Retrieve All Blocks

Call `mcp__notion__API-get-block-children` with the source page ID.

For each block where `has_children: true`, recursively call `mcp__notion__API-get-block-children` with that block's `id` and collect the child blocks.

Extract plain text from every block's `rich_text` array by joining all `plain_text` values. Assemble all extracted text into a single document, preserving section structure (use heading text as section labels followed by their content).

## Step 3 — Apply Transformation

Using the assembled plain-text document, generate the study guide in your own words:

**Section 1 — Overview**
Write 2–3 sentences that answer: What is this page about? What are the main topics? Why do they matter?

**Section 2 — Key Concepts**
Scan the full content and identify every distinct term, tool, algorithm, architecture, or concept that is defined or meaningfully explained. For each one write:
`<Term> — <one-sentence definition based strictly on the source content>`
Produce at minimum one entry per major topic section found in the source.

**Section 3 — Q&A Review**
Generate 5–10 questions that test comprehension of the most important ideas. For each question write a concise, accurate answer drawn from the source content. Aim for questions that require understanding, not just recall. Cover at least one question per major topic section.

## Step 4 — Build Output Blocks

Translate the generated study guide into a flat list of `paragraph` and `bulleted_list_item` blocks.

Use this layout:

```
paragraph:   "Overview"
paragraph:   "<overview text>"
paragraph:   ""   ← blank separator
paragraph:   "Key Concepts"
bulleted_list_item: "<Term> — <definition>"
bulleted_list_item: "<Term> — <definition>"
...
paragraph:   ""
paragraph:   "Q&A Review"
paragraph:   "Q: <question>"
paragraph:   "A: <answer>"
paragraph:   ""
paragraph:   "Q: <question>"
paragraph:   "A: <answer>"
...
```

Split into chunks of at most 100 blocks.

## Step 5 — Create Output Page

Call `mcp__notion__API-post-page` with:
```json
{
  "parent": { "page_id": "<parent-id>" },
  "properties": {
    "title": { "title": [{ "type": "text", "text": { "content": "Study Guide: <source-title>" } }] }
  }
}
```

Capture the new page's `id` from the response.

## Step 6 — Write Blocks

For each chunk of up to 100 blocks, call `mcp__notion__API-patch-block-children` with:
```json
{ "block_id": "<new-page-id>", "children": [ ...chunk ] }
```

## Step 7 — Report

Output:
```
Processed "<source-title>" → Study Guide: <source-title>
https://notion.so/<new-page-id-no-dashes>
```
