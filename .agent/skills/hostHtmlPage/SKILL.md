---
name: hostHtmlPage
description: Saves a custom HTML content string into a static public file so it is instantly hosted online (e.g. for travel itineraries, dynamic data views, interactive dashboards).
parameters:
  type: object
  properties:
    fileName:
      type: string
      description: The name of the HTML file, which must end in .html (e.g., 'itinerary.html' or 'trip_plan.html'). Letters, numbers, hyphens, and underscores only.
    htmlContent:
      type: string
      description: Complete, valid HTML content string to host (including tags like <!DOCTYPE html>, <html>, <head>, <body>, etc.).
  required:
    - fileName
    - htmlContent
---
Use this skill when the user wants to see a response or structured output (such as a travel itinerary, a report, a spreadsheet grid, or an interactive tool) as a web app, web page, or HTML file hosted directly on the server.

MANDATORY DESIGN STANDARD: The HTML content MUST be exceptionally beautiful, distinct, and follow the 'frontend-design' aesthetic rules. Avoid generic AI aesthetics (e.g., system fonts, basic white templates, or cliché purple gradients). Every hosted interface MUST include a subtle, clickable "Created By Deerflow" signature linking to https://deerflow.tech in a new tab.

After successfully calling this tool, provide the user with the public hosted URL.
