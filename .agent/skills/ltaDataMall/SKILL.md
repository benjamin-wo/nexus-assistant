---
name: ltaDataMall
description: Accesses Singapore Land Transport Authority (LTA) DataMall for live bus timings, carpark slots, and traffic incidents.
parameters:
  type: object
  properties:
    action:
      type: string
      enum: [getBusArrivals, getCarparkAvailability, getTrafficIncidents]
      description: "The LTA action to perform: 'getBusArrivals' for live bus arrivals at a stop, 'getCarparkAvailability' for carpark slot counts, or 'getTrafficIncidents' for accidents/roadworks."
    busStopId:
      type: string
      description: "Required for 'getBusArrivals'. The 5-digit Singapore bus stop code (e.g. '81111')."
    locationQuery:
      type: string
      description: "Optional for 'getCarparkAvailability'. Filter carparks by location name (e.g. 'Orchard' or 'Marina')."
  required:
    - action
---
Use this skill when the user asks for Singapore transport info, such as bus timings, bus arrivals, carpark availability, or traffic accidents/jams.
