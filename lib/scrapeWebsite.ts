/**
 * Fetches a website URL and extracts plain text content.
 * LinkedIn URLs are skipped (blocked by anti-bot). Returns null on failure.
 */
export async function scrapeWebsite(url: string): Promise<string | null> {
  if (!url) return null;

  // LinkedIn blocks scraping — skip silently
  if (url.includes("linkedin.com")) return null;

  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(normalized, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ZinniaBot/1.0; +https://zinniagroup.io)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Strip scripts, styles, nav, footer noise
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Keep first 3000 chars — enough context without blowing the prompt
    return cleaned.slice(0, 3000) || null;
  } catch {
    return null;
  }
}
