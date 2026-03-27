import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { scrapeWebsite } from "@/lib/scrapeWebsite";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { prospectName, websiteUrl, linkedinUrl } = await req.json();

    // Scrape the prospect's website for real context
    const websiteContent = websiteUrl ? await scrapeWebsite(websiteUrl) : null;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: `You are Leo Hsu, CEO of Zinnia Group, a digital marketing agency specialized in asset & wealth management. Based on a prospect's name and URLs, suggest the right intake form values for a proposal.

Return ONLY valid JSON with this exact structure:
{
  "prospectProfile": "no_digital_presence" | "basic_presence" | "solid_presence",
  "services": array of: "linkedin_management" | "full_stack" | "marketing_strategy" | "website_development" | "executive_positioning" | "one_pager" | "brand_manual" | "media_amplification",
  "suggestedPrice": number (USD/mo, round number like 1500, 1750, 1900, 2200, 2700),
  "notes": "2-3 sentences about the prospect's likely pain points and situation based on their name/industry",
  "language": "english" | "spanish"
}

Guidelines:
- Infer language from company name or website content (Spanish → "spanish")
- If website content is provided, use it to assess their current digital presence
- Most wealth management firms need: full_stack + one_pager at minimum
- Suggest media_amplification only if they seem established
- Price range: $1,500-$3,000/mo depending on scope
- Be concise and specific in notes — reference what you actually found on their website`,
      messages: [
        {
          role: "user",
          content: `Prospect: ${prospectName}
Website: ${websiteUrl || "not provided"}
LinkedIn: ${linkedinUrl || "not provided"}${
  websiteContent
    ? `\n\nWebsite content (scraped):\n${websiteContent}`
    : websiteUrl
    ? "\n\n(Website could not be scraped — use general knowledge)"
    : ""
}

Suggest form values for this prospect.`,
        },
      ],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text : "{}";
    const json = raw.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const suggestions = JSON.parse(json);

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("Suggest form error:", error);
    return NextResponse.json({ error: "Failed to suggest" }, { status: 500 });
  }
}
