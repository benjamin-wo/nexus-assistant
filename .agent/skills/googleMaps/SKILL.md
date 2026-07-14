---
name: googleMaps
description: Accesses Google Maps Platform APIs for Place Search, Directions, and Geocoding.
parameters:
  type: object
  properties:
    action:
      type: string
      enum: [searchPlaces, getDirections, geocode]
      description: "The Google Maps action to perform: 'searchPlaces' to search for locations/businesses, 'getDirections' to get routing directions between two locations, or 'geocode' to resolve an address to coordinates."
    query:
      type: string
      description: "Required for 'searchPlaces' and 'geocode' actions. The search query or address (e.g. 'coffee near Union Square' or '1600 Amphitheatre Pkwy, Mountain View, CA')."
    origin:
      type: string
      description: "Required for 'getDirections' action. The starting point address or coordinates."
    destination:
      type: string
      description: "Required for 'getDirections' action. The destination address or coordinates."
    mode:
      type: string
      enum: [driving, walking, bicycling, transit]
      description: "Optional for 'getDirections' action. Travel mode (defaults to 'driving')."
  required:
    - action
---
Use this skill when the user asks to search for places, find restaurants, get routing or travel directions, get estimated travel time, or look up geographic coordinates and address information.
