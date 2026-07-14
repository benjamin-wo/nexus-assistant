---
name: saveResearchNote
description: Saves a structured research note or scraped content for the user.
parameters:
  type: object
  properties:
    title:
      type: string
      description: The heading or title of the research note (e.g. AI Trends 2026).
    content:
      type: string
      description: The detailed markdown body or content of the note.
  required:
    - title
    - content
---
Use this skill whenever the user asks to save, archive, store, or remember a research note, a web scrape summary, or general notes.
