---
name: ltaDataMall
description: Accesses Singapore Land Transport Authority (LTA) DataMall for live bus timings, carpark slots, and traffic incidents.
parameters:
  type: object
  properties:
    action:
      type: string
      enum: [getBusArrivals, getCarparkAvailability, getTrafficIncidents, getBusStopInfo]
      description: "The LTA action to perform: 'getBusArrivals' for live bus arrivals at a stop, 'getCarparkAvailability' for carpark slot counts, 'getTrafficIncidents' for accidents/roadworks, or 'getBusStopInfo' to resolve a stop code to its name/road or search by location name."
    busStopId:
      type: string
      description: "Required for 'getBusArrivals'. The 5-digit Singapore bus stop code (e.g. '81111') or a text query describing the stop or road name (e.g. 'Dhoby Ghaut' or 'Changi Airport')."
    locationQuery:
      type: string
      description: "Optional for 'getCarparkAvailability'. Filter carparks by location name (e.g. 'Orchard' or 'Marina')."
  required:
    - action
---
Use this skill when the user asks for Singapore transport info, such as bus timings, bus arrivals, carpark availability, traffic accidents/jams, or to resolve a bus stop code to a human-readable name and road name.
