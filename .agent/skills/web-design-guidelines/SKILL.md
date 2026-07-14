---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
parameters:
  type: object
  properties:
    targetFile:
      type: string
      description: "The relative path of the file in the workspace to review (e.g., 'src/public/index.html')."
  required:
    - targetFile
---
Use this skill when asked to review UI code, check accessibility, audit design, or check web interface compliance.
It fetches the latest web design guidelines from Vercel and reads the target file. Perform the review based on the guidelines returned and report the issues in the format specified.
