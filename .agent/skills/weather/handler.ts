export async function execute(args: { location: string }) {
  const { location } = args;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (apiKey) {
    try {
      // 1. Geocode the location name to coordinates using Google Maps
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        location
      )}&key=${apiKey}`;
      const geoRes = await fetch(geocodeUrl);
      if (!geoRes.ok) throw new Error(`Geocoding failed: ${geoRes.statusText}`);
      
      const geoData = (await geoRes.json()) as any;
      if (geoData.status !== "OK" || !geoData.results?.[0]) {
        throw new Error(`Google Maps Geocoding status: ${geoData.status}`);
      }

      const place = geoData.results[0];
      const { lat, lng } = place.geometry.location;
      const formattedAddress = place.formatted_address;

      // 2. Fetch real weather data from Open-Meteo using coordinates
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`;
      const weatherRes = await fetch(weatherUrl);
      if (!weatherRes.ok) throw new Error(`Weather fetch failed: ${weatherRes.statusText}`);
      
      const weatherData = (await weatherRes.json()) as any;
      const current = weatherData.current;

      if (current) {
        // Map WMO Weather Codes to descriptions
        const wmoCodes: { [key: number]: string } = {
          0: "Clear sky ☀️",
          1: "Mainly clear 🌤️",
          2: "Partly cloudy ⛅",
          3: "Overcast ☁️",
          45: "Foggy 🌫️",
          48: "Depositing rime fog 🌫️",
          51: "Light drizzle 🌧️",
          53: "Moderate drizzle 🌧️",
          55: "Dense drizzle 🌧️",
          61: "Slight rain 🌧️",
          63: "Moderate rain 🌧️",
          65: "Heavy rain 🌧️",
          71: "Slight snow ❄️",
          73: "Moderate snow ❄️",
          75: "Heavy snow ❄️",
          80: "Slight rain showers 🌦️",
          81: "Moderate rain showers 🌦️",
          82: "Violent rain showers 🌦️",
          95: "Thunderstorm ⛈️",
          96: "Thunderstorm with slight hail ⛈️",
          99: "Thunderstorm with heavy hail ⛈️",
        };

        const condition = wmoCodes[current.weather_code] || "Unspecified weather conditions";
        const temp = current.temperature_2m;
        const feelsLike = current.apparent_temperature;
        const humidity = current.relative_humidity_2m;
        const wind = current.wind_speed_10m;

        return {
          success: true,
          location: formattedAddress,
          temperature: `${temp}°C`,
          feelsLike: `${feelsLike}°C`,
          humidity: `${humidity}%`,
          windSpeed: `${wind} km/h`,
          conditions: condition,
          forecast: `The current weather in ${formattedAddress} is ${condition.toLowerCase()}. It feels like ${feelsLike}°C with a relative humidity of ${humidity}% and wind speeds of ${wind} km/h.`,
        };
      }
    } catch (err: any) {
      console.warn(`[Weather Service] Error calling real APIs, falling back to mock:`, err.message);
    }
  }

  // Fallback: Simple pseudo-random mock forecast based on city name characters
  let charSum = 0;
  for (let i = 0; i < location.length; i++) {
    charSum += location.charCodeAt(i);
  }

  const temp = 15 + (charSum % 20); // between 15°C and 35°C
  const humidity = 40 + (charSum % 50); // between 40% and 90%
  const conditions = ["Sunny ☀️", "Partly Cloudy ⛅", "Rainy 🌧️", "Overcast ☁️", "Windy 💨"][charSum % 5];

  return {
    success: true,
    location,
    temperature: `${temp}°C`,
    humidity: `${humidity}%`,
    conditions,
    forecast: `[Mock Forecast] Expect ${conditions.toLowerCase()} weather in ${location} today. Temperatures will peak around ${temp}°C.`,
  };
}
