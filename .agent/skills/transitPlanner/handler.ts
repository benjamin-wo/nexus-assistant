// Haversine formula — great-circle distance between two lat/lng points in metres
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fetch and cache ALL Singapore bus stops from LTA DataMall (paginated in batches of 500)
let busStopCache: { code: string; description: string; roadName: string; lat: number; lng: number }[] | null = null;

async function fetchAllBusStops(ltaKey: string) {
  if (busStopCache) return busStopCache;

  busStopCache = [];
  let skip = 0;
  const headers = { AccountKey: ltaKey, accept: "application/json" };

  while (true) {
    const res = await fetch(
      `https://datamall2.mytransport.sg/ltaodataservice/BusStops?$skip=${skip}`,
      { headers }
    );
    if (!res.ok) break;
    const data = (await res.json()) as any;
    const batch: any[] = data.value || [];
    if (batch.length === 0) break;

    for (const s of batch) {
      busStopCache.push({
        code: s.BusStopCode,
        description: s.Description,
        roadName: s.RoadName,
        lat: s.Latitude,
        lng: s.Longitude,
      });
    }
    if (batch.length < 500) break;
    skip += 500;
  }

  return busStopCache;
}

// Fetch live bus arrivals for a stop code, returns top services with human-friendly ETA
async function fetchArrivals(stopCode: string, ltaKey: string) {
  const headers = { AccountKey: ltaKey, accept: "application/json" };
  const res = await fetch(
    `https://datamall2.mytransport.sg/ltaodataservice/BusArrivalv2?BusStopID=${stopCode}`,
    { headers }
  );
  if (!res.ok) return [];

  const data = (await res.json()) as any;
  const getMins = (estArrival: string) => {
    if (!estArrival) return null;
    const diff = new Date(estArrival).getTime() - Date.now();
    const mins = Math.ceil(diff / 60000);
    return mins <= 0 ? "Arr" : `${mins}m`;
  };

  return (data.Services || []).slice(0, 6).map((s: any) => ({
    serviceNo: s.ServiceNo,
    next: getMins(s.NextBus?.EstimatedArrival),
    next2: getMins(s.NextBus2?.EstimatedArrival),
    next3: getMins(s.NextBus3?.EstimatedArrival),
    load: s.NextBus?.Load || "",
  }));
}

export async function execute(args: {
  destination: string;
  origin?: string;
  maxStops?: number;
}) {
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  const ltaKey = process.env.LTA_ACCOUNT_KEY;

  if (!mapsKey) throw new Error("GOOGLE_MAPS_API_KEY is not configured.");
  if (!ltaKey) throw new Error("LTA_ACCOUNT_KEY is not configured.");

  const { destination, origin, maxStops = 3 } = args;

  // ── Step 1: Geocode the destination via Google Maps ──────────────────────────
  const geocodeRes = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination + ", Singapore")}&key=${mapsKey}`
  );
  if (!geocodeRes.ok) throw new Error(`Google Maps Geocoding failed: ${geocodeRes.status}`);
  const geocodeData = (await geocodeRes.json()) as any;

  if (!geocodeData.results?.length) {
    return { success: false, message: `Could not find location: "${destination}". Try a more specific address.` };
  }

  const destResult = geocodeData.results[0];
  const destAddress = destResult.formatted_address;
  const destLat: number = destResult.geometry.location.lat;
  const destLng: number = destResult.geometry.location.lng;

  // ── Step 2: Optionally get transit directions from Google Maps ────────────────
  let transitSummary: string | null = null;
  if (origin) {
    const dirRes = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destAddress)}&mode=transit&key=${mapsKey}`
    );
    if (dirRes.ok) {
      const dirData = (await dirRes.json()) as any;
      const route = dirData.routes?.[0];
      const leg = route?.legs?.[0];
      if (leg) {
        transitSummary = `${leg.duration?.text} (${leg.distance?.text}) via transit`;
      }
    }
  }

  // ── Step 3: Load all LTA bus stops and find the N closest ones ───────────────
  const allStops = await fetchAllBusStops(ltaKey);
  const nearest = allStops
    .map((stop) => ({
      ...stop,
      distanceM: haversine(destLat, destLng, stop.lat, stop.lng),
    }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, maxStops);

  // ── Step 4: Fetch live arrivals for each nearby stop ─────────────────────────
  const stopsWithArrivals = await Promise.all(
    nearest.map(async (stop) => {
      const arrivals = await fetchArrivals(stop.code, ltaKey);
      return {
        code: stop.code,
        name: stop.description,
        road: stop.roadName,
        distanceM: Math.round(stop.distanceM),
        walkMinutes: Math.round(stop.distanceM / 80), // ~80m/min walking pace
        arrivals,
      };
    })
  );

  return {
    success: true,
    destination: destAddress,
    destinationCoords: { lat: destLat, lng: destLng },
    transitSummary,
    nearbyStops: stopsWithArrivals,
  };
}
