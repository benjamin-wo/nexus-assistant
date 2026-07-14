---
name: fileOps
description: Performs filesystem operations (read, write, list) within the workspace directory.
parameters:
  type: object
  properties:
    operation:
      type: string
      enum:
        - read
        - write
        - list
      description: The action to perform on the filesystem.
    path:
      type: string
      description: The relative file or directory path (e.g., "logs.txt", "docs/report.md").
    content:
      type: string
      description: The text content to write (required only for the 'write' operation).
  required:
    - operation
    - path
---
Always verify paths are relative and keep operations strictly within the workspace. 
Do not attempt to read or write sensitive system files.
