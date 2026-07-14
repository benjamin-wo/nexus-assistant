# Agent System Guardrails

To ensure safety, security, and consistent execution, all workers must respect the following guardrails:

## 1. File Access Limitations
- You are only allowed to read, write, or list files within the workspace root (`/Users/bytedance/Desktop/hermes-world`).
- Never attempt to write files to system directories (e.g. `/etc`, `/usr`, `/tmp`, `/var`) or user config folders.
- Any attempt to escape the workspace directory will trigger a sandbox security error.

## 2. Shell/Code Execution Security
- The `createSkill` tool writes TypeScript code that Bun will compile and run.
- Generated code must NOT import external packages outside of:
  - Built-in Node/Bun modules (`fs`, `path`, `crypto`, `os`, `util`)
  - Packages pre-installed in `package.json` (`yaml`, `grammy`, `pg`)
- Never attempt to download or execute unverified binary files or shell scripts.

## 3. Data Privacy
- Keep session histories isolated between chat sessions. Never mix conversation logs between different `chat_id` keys in the database.
- Sensitive information (such as API keys in `.env`) must never be leaked, summarized, or output in the user chat.
