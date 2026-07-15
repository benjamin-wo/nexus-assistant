---
name: logImprovement
description: Use this skill when the user suggests a codebase feature, enhancement, or improvement. It will parse their request and log it into the database for the end-of-day coding session.
---

# Log Improvement Skill

This skill allows you to capture user-suggested feature improvements or architectural changes and store them safely in the database.

## When to Use
- The user says "we should add dark mode".
- The user says "can we make the button blue?".
- The user asks for a feature that requires codebase changes, but they explicitly want it queued for later or the workflow is designed to aggregate improvements for an end-of-day coding session.

## What it Does
This skill executes a simple node script that calls the `StorageService` to log a new event with category `IMPROVEMENT`.

## How to use

1. Run the following command using the `run_command` tool. Replace `[summary]` with a short 1-line summary of the feature, and `[details]` with any architectural notes or context you think the coder will need later.

```bash
bun eval 'import { StorageService } from "./src/database/Storage.ts"; const s = new StorageService(); await s.initialize(); await s.logEvent({ category: "IMPROVEMENT", message: process.argv[1], details: process.argv[2], isError: false }); await s.close();' "[summary]" "[details]"
```

2. Let the user know you have logged their improvement idea for the end-of-day coding session!
