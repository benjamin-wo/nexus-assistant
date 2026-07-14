export async function execute(args: { url: string }) {
  const { url } = args;

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("Invalid URL. URL must start with http:// or https://");
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP fetch failed with status: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Extract text content cleanly by stripping scripts, styles, and markup
    let text = html
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();

    // Truncate text to avoid flooding the context window
    if (text.length > 8000) {
      text = text.substring(0, 8000) + "\n... [truncated for length]";
    }

    return {
      url,
      success: true,
      length: text.length,
      content: text,
    };
  } catch (error: any) {
    throw new Error(`Failed to scrape page: ${error.message}`);
  }
}
