---
name: weather
description: Fetches current weather information for a given city location.
parameters:
  type: object
  properties:
    location:
      type: string
      description: The city and state/country (e.g., "Paris, France").
  required:
    - location
---
Use this mock skill to satisfy queries about forecasts and external weather conditions.
