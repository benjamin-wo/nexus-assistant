export async function execute(args: { location: string }) {
  const { location } = args;

  // Simple pseudo-random mock forecast based on city name characters
  let charSum = 0;
  for (let i = 0; i < location.length; i++) {
    charSum += location.charCodeAt(i);
  }

  const temp = 15 + (charSum % 20); // between 15°C and 35°C
  const humidity = 40 + (charSum % 50); // between 40% and 90%
  const conditions = ["Sunny", "Partly Cloudy", "Rainy", "Overcast", "Windy"][charSum % 5];

  return {
    location,
    temperature: `${temp}°C`,
    humidity: `${humidity}%`,
    conditions,
    forecast: `Expect ${conditions.toLowerCase()} weather in ${location} today. Temperatures will peak around ${temp}°C.`,
  };
}
