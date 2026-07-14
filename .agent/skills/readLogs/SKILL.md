---
name: readLogs
description: Retrieve the recent execution logs and errors from the database. Use this tool to inspect recent events, errors, latencies, or debug system behavior.
parameters:
  type: object
  properties:
    limit:
      type: number
      description: The maximum number of log entries to retrieve. Defaults to 20.
---
Use this skill when you need to inspect database event logs, debug errors, audit operations, or when performing DevOps status checks.
