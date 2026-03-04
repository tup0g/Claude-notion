---
name: gdrive-save
description: Uploads a local file to Google Drive using the OAuth2 token from gdrive-auth/. Auto-invoke when user asks to upload, save, or push a local file to Google Drive.
argument-hint: "<file-path>"
---

## Required Tools

- Bash
- AskUserQuestion

## Input Parsing

Parse `$ARGUMENTS` for:
- `file-path`: required positional argument — path to the local file to upload

If `file-path` is missing, ask:
```
AskUserQuestion: "Please provide the path to the local file you want to upload to Google Drive."
```

Resolve the file path relative to the current working directory if it is not absolute.

## Step 1 — Verify File Exists

Use Bash to check the file exists:
```sh
test -f "<file-path>" && echo "ok" || echo "not found"
```

If the file is not found, report an error and stop:
```
Error: File not found — <file-path>
```

## Step 2 — Run Upload Script

Run the upload script from the project root:
```sh
node gdrive-save.js "<file-path>"
```

The script outputs three lines on success:
```
Uploaded: <filename>
ID: <google-drive-file-id>
Link: <webViewLink>
```

If the script exits with a non-zero code or prints "Upload failed:", report the error and stop:
```
Error: Upload failed — <error message from script>
```

## Step 3 — Report

Output a single confirmation block:
```
Uploaded "<filename>" → Google Drive
ID: <file-id>
Link: <webViewLink>
```
