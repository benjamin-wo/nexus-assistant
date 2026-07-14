---
name: transitPlanner
description: Plans a door-to-door public transit route to a destination in Singapore. Geocodes the destination using Google Maps, finds the nearest bus stops using LTA data, and fetches live bus arrival timings. Use when the user asks how to get somewhere by bus, wants transit directions in Singapore, or has an appointment at a specific venue and needs live commute info.
parameters:
  type: object
  properties:
    destination:
      type: string
      description: "The destination in plain English (e.g. 'Marina Bay Sands', '1 Raffles Place', 'Changi Airport Terminal 2')."
    origin:
      type: string
      description: "Optional. The starting point in plain English. Defaults to the user's last known location or a central hub if not provided."
    maxStops:
      type: number
      description: "Optional. Maximum number of nearby bus stops to include in the plan. Defaults to 3."
  required:
    - destination
---
Use this skill to plan a complete door-to-door public transit route in Singapore. It combines Google Maps geocoding with live LTA bus stop data and arrival timings.
