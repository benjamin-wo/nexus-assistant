// In-memory cache for bus stop lookup (populated once per process lifetime)
let busStopCache: Map<string, { description: string; roadName: string; lat: number; lng: number }> | null = null;

async function getBusStopCache(headers: Record<string, string>) {
  if (busStopCache) return busStopCache;

  // LTA paginates BusStops in increments of 500 via $skip
  busStopCache = new Map();
  let skip = 0;
  while (true) {
    const url = `https://datamall2.mytransport.sg/ltaodataservice/BusStops?$skip=${skip}`;
    const res = await fetch(url, { headers });
    if (!res.ok) break;
    const data = (await res.json()) as any;
    const batch: any[] = data.value || [];
    if (batch.length === 0) break;
    for (const stop of batch) {
      busStopCache.set(stop.BusStopCode, {
        description: stop.Description,
        roadName: stop.RoadName,
        lat: stop.Latitude,
        lng: stop.Longitude,
      });
    }
    if (batch.length < 500) break;
    skip += 500;
  }
  return busStopCache;
}

export async function execute(args: {
  action: "getBusArrivals" | "getCarparkAvailability" | "getTrafficIncidents" | "getBusStopInfo";
  busStopId?: string;
  locationQuery?: string;
}) {
  const accountKey = process.env.LTA_ACCOUNT_KEY;
  if (!accountKey) {
    throw new Error(
      "LTA_ACCOUNT_KEY is not configured. Please add your LTA DataMall Account Key to environment variables."
    );
  }

  const { action, busStopId, locationQuery } = args;
  const headers = {
    AccountKey: accountKey,
    accept: "application/json",
  };

  switch (action) {
    case "getBusStopInfo": {
      // Resolve a bus stop code → name, or a name/road query → list of matching stops
      const cache = await getBusStopCache(headers);

      if (busStopId && /^\d{5}$/.test(busStopId.trim())) {
        // Exact 5-digit code lookup
        const stop = cache.get(busStopId.trim());
        if (!stop) return { success: false, message: `No bus stop found with code '${busStopId}'.` };
        return { success: true, busStopCode: busStopId, ...stop };
      }

      // Text search by description or road name
      const query = (busStopId || locationQuery || "").toLowerCase();
      if (!query) throw new Error("Provide a busStopId code or a locationQuery string to search.");

      const matches: any[] = [];
      for (const [code, stop] of cache.entries()) {
        if (stop.description.toLowerCase().includes(query) || stop.roadName.toLowerCase().includes(query)) {
          matches.push({ busStopCode: code, ...stop });
          if (matches.length >= 10) break;
        }
      }

      return { success: true, query, matches };
    }

    case "getBusArrivals": {
      if (!busStopId) {
        throw new Error("Parameter 'busStopId' is required for action 'getBusArrivals'.");
      }

      // Resolve a text name to a stop code if needed
      let resolvedCode = busStopId.trim();
      let stopName: string | null = null;
      let roadName: string | null = null;

      if (!/^\d{5}$/.test(resolvedCode)) {
        // User gave a name — search the cache for the best match
        const cache = await getBusStopCache(headers);
        const query = resolvedCode.toLowerCase();
        for (const [code, stop] of cache.entries()) {
          if (stop.description.toLowerCase().includes(query) || stop.roadName.toLowerCase().includes(query)) {
            resolvedCode = code;
            stopName = stop.description;
            roadName = stop.roadName;
            break;
          }
        }
        if (!/^\d{5}$/.test(resolvedCode)) {
          return { success: false, message: `Could not find a bus stop matching '${busStopId}'. Try using a 5-digit stop code.` };
        }
      } else {
        // Enrich a numeric code with a human-readable name
        const cache = await getBusStopCache(headers);
        const stop = cache.get(resolvedCode);
        if (stop) {
          stopName = stop.description;
          roadName = stop.roadName;
        }
      }

      const url = `https://datamall2.mytransport.sg/ltaodataservice/BusArrivalv2?BusStopID=${resolvedCode}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`LTA BusArrival request failed with status: ${res.status}`);

      const data = (await res.json()) as any;
      const services = (data.Services || []).map((s: any) => {
        const getMins = (estArrival: string) => {
          if (!estArrival) return null;
          const diff = new Date(estArrival).getTime() - Date.now();
          const mins = Math.ceil(diff / 60000);
          return mins <= 0 ? "Arr" : `${mins}m`;
        };

        return {
          serviceNo: s.ServiceNo,
          operator: s.Operator,
          nextBus: getMins(s.NextBus?.EstimatedArrival),
          nextBusLoad: s.NextBus?.Load || "", // SEA, SDA, LSD
          nextBus2: getMins(s.NextBus2?.EstimatedArrival),
          nextBus3: getMins(s.NextBus3?.EstimatedArrival),
        };
      });

      return { success: true, busStopCode: resolvedCode, stopName, roadName, services };
    }

    case "getCarparkAvailability": {
      const url = "https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2";
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`LTA CarparkAvailability request failed with status: ${res.status}`);

      const data = (await res.json()) as any;
      let carparks = (data.value || []).map((c: any) => ({
        development: c.Development,
        area: c.Area,
        availableLots: c.AvailableLots,
        lotType: c.LotType,
        agency: c.Agency,
      }));

      if (locationQuery) {
        const query = locationQuery.toLowerCase();
        carparks = carparks.filter(
          (c: any) =>
            c.development.toLowerCase().includes(query) ||
            c.area.toLowerCase().includes(query)
        );
      }

      return { success: true, carparks: carparks.slice(0, 10) };
    }

    case "getTrafficIncidents": {
      const url = "https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents";
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`LTA TrafficIncidents request failed with status: ${res.status}`);

      const data = (await res.json()) as any;
      const incidents = (data.value || []).slice(0, 8).map((i: any) => ({
        type: i.Type,
        message: i.Message,
        latitude: i.Latitude,
        longitude: i.Longitude,
      }));

      return { success: true, incidents };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
