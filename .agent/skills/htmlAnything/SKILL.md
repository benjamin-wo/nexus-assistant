---
name: htmlAnything
description: Retrieves templates, CSS design frameworks, and structured HTML examples for html-anything surfaces (magazine, keynote, socialCard, dataReport). Use this when generating visually stunning documents, slides, dashboards, or posters to get premium layout structures.
parameters:
  type: object
  properties:
    layoutType:
      type: string
      enum: [magazine, keynote, socialCard, dataReport]
      description: "The desired layout type: 'magazine' for editorial print articles, 'keynote' for presentation slides, 'socialCard' for high-impact visual cards, or 'dataReport' for clean dashboard metrics."
  required:
    - layoutType
---
Use this skill when you want to retrieve clean CSS frameworks, Google Fonts imports, and boilerplate HTML layouts for specific design surfaces. You can then populate these boilerplates with the user's specific content and save them using 'hostHtmlPage'.
