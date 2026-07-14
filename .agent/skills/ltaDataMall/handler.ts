export async function execute(args: {
  action: "getBusArrivals" | "getCarparkAvailability" | "getTrafficIncidents";
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
    case "getBusArrivals": {
      if (!busStopId) {
        throw new Error("Parameter 'busStopId' is required for action 'getBusArrivals'.");
      }
      const url = `https://datamall2.mytransport.sg/ltaodataservice/BusArrivalv2?BusStopID=${busStopId}`;
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

      return { success: true, busStopId, services };
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
