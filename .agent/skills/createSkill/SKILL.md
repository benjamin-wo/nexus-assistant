---
name: createSkill
description: Dynamically writes and registers a new modular skill at runtime.
parameters:
  type: object
  properties:
    name:
      type: string
      description: Single-word name slug for the new skill (camelCase, e.g. cryptoPrice).
    description:
      type: string
      description: Summary of what the skill does.
    parameters:
      type: object
      description: JSON Schema parameters object defining inputs (properties, required).
    instructions:
      type: string
      description: Markdown prompt instructions explaining how the model should behave when using this tool.
    codeContent:
      type: string
      description: Executable TypeScript. Must export an async function named execute(args: any).
  required:
    - name
    - description
    - parameters
    - instructions
    - codeContent
---
Use this meta-skill when the user explicitly requests to build or teach the assistant a new capability, or when a workflow needs to be encapsulated for easy reuse.
Ensure parameter schemas are strict and codeContent compiles.
