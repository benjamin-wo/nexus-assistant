export async function execute(args: { query: string }) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "TAVILY_API_KEY is not configured. Please add your Tavily API Key to environment variables."
    );
  }

  const query = args.query;

  // Generate 3 search queries representing different research angles
  const angles = [
    `${query} overview, key concepts, definitions`,
    `${query} latest developments, news, trends 2026`,
    `${query} challenges, limitations, criticisms, controversies`
  ];

  console.log(`[Deep Research] Starting parallel multi-angle search for: "${query}"`);

  try {
    const searchPromises = angles.map(async (angleQuery, index) => {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: angleQuery,
          search_depth: "basic",
          max_results: 3,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Tavily API search error on angle ${index + 1} (${res.status}): ${errText}`);
      }

      const data = (await res.json()) as any;
      return {
        angle: index === 0 ? "Conceptual Overview" : index === 1 ? "Latest Trends & News" : "Challenges & Critiques",
        query: angleQuery,
        results: (data.results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.content
        }))
      };
    });

    const searchResults = await Promise.all(searchPromises);

    return {
      success: true,
      topic: query,
      researchReport: searchResults
    };
  } catch (err: any) {
    throw new Error(`Deep Research execution failed: ${err.message}`);
  }
}
