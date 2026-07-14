export async function execute(args: { query: string }) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "TAVILY_API_KEY is not configured. Please add your Tavily API Key to environment variables."
    );
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: args.query,
      search_depth: "basic",
      max_results: 5,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tavily API search error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as any;
  const results = (data.results || []).map((r: any) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
  }));

  return { success: true, results };
}
