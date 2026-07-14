export async function execute(args: {
  action: "searchPlaces" | "getDirections" | "geocode";
  query?: string;
  origin?: string;
  destination?: string;
  mode?: "driving" | "walking" | "bicycling" | "transit";
}) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_MAPS_API_KEY is not configured. Please add your Google Maps API Key to environment variables."
    );
  }

  const { action, query, origin, destination, mode } = args;

  switch (action) {
    case "searchPlaces": {
      if (!query) {
        throw new Error("Parameter 'query' is required for action 'searchPlaces'.");
      }
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        query
      )}&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Places API request failed with status: ${res.status}`);
      const data = (await res.json()) as any;
      const results = (data.results || []).slice(0, 5).map((r: any) => ({
        name: r.name,
        address: r.formatted_address,
        rating: r.rating,
        userRatingsTotal: r.user_ratings_total,
        location: r.geometry?.location,
      }));
      return { success: true, results };
    }

    case "geocode": {
      if (!query) {
        throw new Error("Parameter 'query' is required for action 'geocode'.");
      }
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        query
      )}&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Geocoding API request failed with status: ${res.status}`);
      const data = (await res.json()) as any;
      const results = (data.results || []).slice(0, 3).map((r: any) => ({
        address: r.formatted_address,
        location: r.geometry?.location,
        type: r.types,
      }));
      return { success: true, results };
    }

    case "getDirections": {
      if (!origin || !destination) {
        throw new Error("Parameters 'origin' and 'destination' are required for action 'getDirections'.");
      }
      const travelMode = mode || "driving";
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
        origin
      )}&destination=${encodeURIComponent(destination)}&mode=${travelMode}&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Directions API request failed with status: ${res.status}`);
      const data = (await res.json()) as any;
      
      const routes = (data.routes || []).map((r: any) => {
        const leg = r.legs?.[0];
        return {
          summary: r.summary,
          distance: leg?.distance?.text,
          duration: leg?.duration?.text,
          steps: (leg?.steps || []).map((s: any) => ({
            instructions: s.html_instructions?.replace(/<[^>]*>/g, ""), // strip HTML tags
            distance: s.distance?.text,
            duration: s.duration?.text,
          })),
        };
      });
      return { success: true, routes };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
