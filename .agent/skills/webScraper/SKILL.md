---
name: webScraper
description: Scrapes HTML page content from a specified URL and summarizes its readable text.
parameters:
  type: object
  properties:
    url:
      type: string
      description: The absolute HTTP/HTTPS URL of the web page to scrape.
  required:
    - url
---
Use this tool when search results, documentation pages, or article URLs are requested.
Only fetch pages from public sites. Do not crawl private resources.
