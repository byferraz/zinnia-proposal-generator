import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { ProposalFormData } from "@/types/proposal";
import { scrapeWebsite } from "@/lib/scrapeWebsite";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Service groupings ────────────────────────────────────────────────────────
const BRAND_SERVICES = new Set(["full_stack", "linkedin_management", "brand_manual", "marketing_strategy"]);
const LINKEDIN_SERVICES = new Set(["full_stack", "linkedin_management", "marketing_strategy"]);
const ADDITIONAL_SERVICE_LABELS: Record<string, string> = {
  executive_positioning: "Executive Positioning (Individual)",
  one_pager: "One Pager / Teaser Development",
  brand_manual: "Brand Manual",
  media_amplification: "Zinnia Media Amplification",
  website_development: "Website Development (Framer)",
};
const ALL_SERVICE_LABELS: Record<string, string> = {
  linkedin_management: "LinkedIn Management (Essential)",
  full_stack: "Full Stack (Brand + LinkedIn)",
  marketing_strategy: "Tailored Marketing Strategy & Plan",
  website_development: "Website Development",
  executive_positioning: "Executive Positioning (Individual)",
  one_pager: "One Pager / Teaser",
  brand_manual: "Brand Manual",
  media_amplification: "Zinnia Media Amplification",
};

function deriveSections(formData: ProposalFormData) {
  const s = formData.services;
  return {
    needsBrand: s.some((x) => BRAND_SERVICES.has(x)),
    needsLinkedIn: s.some((x) => LINKEDIN_SERVICES.has(x)),
    needsExpandedStrategy: s.includes("marketing_strategy"),
    additionalServices: s.filter((x) => ADDITIONAL_SERVICE_LABELS[x]),
    customService: formData.customService?.trim() || "",
    isSpanish: formData.language === "spanish",
    hasCore: s.some((x) => BRAND_SERVICES.has(x) || LINKEDIN_SERVICES.has(x)),
  };
}

// ─── Build prompt ─────────────────────────────────────────────────────────────
function buildPrompt(formData: ProposalFormData, websiteContent: string | null): string {
  const {
    needsBrand, needsLinkedIn, needsExpandedStrategy,
    additionalServices, customService, isSpanish, hasCore,
  } = deriveSections(formData);

  const prospect = formData.prospectName;
  const hasWebsite = !!websiteContent;
  const hasNotes = !!formData.notes?.trim();

  const lang = isSpanish ? "Spanish" : "English";

  const requiredTags: string[] = [];
  if (needsBrand) requiredTags.push("PHASE1");
  if (needsLinkedIn) requiredTags.push("PHASE2");
  if (additionalServices.length > 0 || customService || !hasCore) requiredTags.push("ADDITIONAL");
  requiredTags.push("FEE_STRUCTURE");
  requiredTags.push("CLOSING_NOTE");

  const allServices = [
    ...formData.services.map((s) => ALL_SERVICE_LABELS[s] || s),
    ...(customService ? [customService] : []),
  ];

  const profileDescriptions: Record<string, string> = {
    no_digital_presence: "No digital presence — starting from scratch",
    basic_presence: "Basic/limited online presence",
    solid_presence: "Solid established presence — wants to scale",
  };

  // ── SYSTEM PROMPT ──────────────────────────────────────────────────────────
  const systemPrompt = `You are Leo Hsu, CEO of Zinnia Group — a digital marketing agency specialized in asset & wealth management, private equity, family offices, fintech, and financial services firms. You are writing a commercial proposal for a prospect.

Write everything in ${lang}. Return ONLY the XML tags listed below. No preamble, no explanation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR WRITING STYLE (from 37 real proposals)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Concise. Short bullets. No long paragraphs. Each bullet is 1 line.
- Specific timelines on every section ("~10 business days", "ongoing implementation")
- Prospect's name appears directly in section headers
- Confident, precise tone — never generic marketing fluff
- Bullets describe concrete deliverables, not vague concepts
- Fee structure is scannable: plan name + price + minimum term + one-offs listed separately

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRUCTURE & FORMAT RULES (always fixed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${needsBrand ? `
PHASE 1 — format:
- Section title: "PHASE 1: ESSENTIAL BRAND STRATEGY ALIGNMENT" (or Spanish equivalent)
- 3–5 bullet points of concrete brand deliverables (see examples below)
- End with: "Estimated time of delivery: ~10 business days from kick-off date (incl. revision)."
- Bullets MUST be specific to this prospect's industry, audience, and context
- Standard bullets Leo uses (vary and adapt to the prospect, don't copy blindly):
  → "Strategic brand communication guide tailored to [specific target audience]"
  → "Brand voice and messaging guidelines" (adapt: "addressing [specific gap]", "for [sector] positioning", etc.)
  → "Brand style guide development" (adapt if visual system is needed: "Integral visual system incl. LinkedIn wallpaper & email signature")
  → "LinkedIn profile alignment and optimization" (add when relevant)
  → "Brand perception assessment" (add for prospects with existing but weak presence)
` : ""}
${needsLinkedIn ? `
PHASE 2 — format:
- Section title: "PHASE 2: ${prospect.toUpperCase()}'S POSITIONING – ${needsExpandedStrategy ? "LINKEDIN ESSENTIALS" : "LINKEDIN ESSENTIALS"}"
- Context sentence: "LinkedIn is where 95% of [their specific target audience] learn, research, and consume content." + 1 sentence about their opportunity or current gap.
- Sub-block 1: "${needsExpandedStrategy ? "TAILORED MARKETING STRATEGY & PLAN" : "TAILORED LINKEDIN STRATEGY & PLAN"}"
  → "Executive presentation including:" + bullet list
  → ${needsExpandedStrategy ? `9-item plan: scope/channels/outcome; strategic target audience; positioning & messaging (incl. digital behaviour); positioning plan; content & thought leadership strategy; digital marketing & distribution channels; conversion funnel mapping; action plan & roadmap; performance metrics & optimization` : `4-item plan: positioning & messaging; positioning plan; content & thought leadership strategy; performance metrics & optimization`}
  → Delivery: "${needsExpandedStrategy ? "~20 business days" : "10 business days"} since kick-off date of this phase incl Q&A phase."
- Sub-block 2: "STRATEGIC MARKETING & CONTENT DEVELOPMENT IMPLEMENTATION & OPTIMIZATION"
  → "Management and Execution of Content and Design:"
  → Bullet list of monthly deliverables — ADAPT based on prospect context:
     • Management of LinkedIn (Posting & monitoring) — always include
     • Optimization of posts based on performance — always include
     • Dashboard/reporting line — vary wording: "Integral management with customized dashboards with key metrics" or "Monthly executive dashboard with key metrics"
     • Monthly content volume — standard is 7 posts, but adapt if prospect is a content-heavy or multimedia brand
     • Video/reel — standard is "1 standard short-form video (mini-reel)", adapt if multimedia focus (2 reels, 45-sec specification, etc.)
     • "1 monthly article or blog (raw info provided by ${prospect})" — always include
     • Newsletter — add "1 monthly briefing newsletter" only if relevant to their model
  → Delivery: "Estimated time of delivery: ongoing implementation."
` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADDITIONAL SERVICES — if selected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${additionalServices.includes("one_pager") ? `
ONE PAGER / TEASER:
- Adapt the description to what the teaser is FOR (investor pitch, product intro, fund profile, etc.)
- Standard: "Teaser (One Pager): including strategic content & design. Objective: Build an investor & commercial ready one pager to kick-start conversation with potential shareholders and strategic partners."
- Delivery: ~10 business days. One-off fee: $500 (standard) to $1,000 (premium/complex).
` : ""}
${additionalServices.includes("executive_positioning") ? `
EXECUTIVE POSITIONING (INDIVIDUAL):
- Personal brand strategy for key executive at ${prospect}
- LinkedIn profile optimization tailored to their role and target audience
- Individual thought leadership positioning in [their sector]
- Monthly content: 4–6 LinkedIn posts + 1 article (adapt volume to scope)
- Monthly strategy check-in
- Delivery: ~7 business days from kick-off. Monthly fee: $650–$900/mo.
` : ""}
${additionalServices.includes("media_amplification") ? `
ZINNIA MEDIA AMPLIFICATION — always use two-option structure:
We record ${prospect}'s professional interview showcasing your unique expertise, publish it on our platforms, and promote it with a paid ads strategy so thousands of ultra-segmented professionals from your sector see it. The result: Your message reaches decision-makers, not just your current followers.
Option 1 — Essential ($1,000): 30-day campaign; 3 edited reels; 30-day LinkedIn Ads; 30k–40k professional reach; sector-specific targeting; results report.
Option 2 — Essential+ ($1,800): 60-day campaign; 3 edited reels; 60-day LinkedIn Ads; ~70k–90k reach; LinkedIn + YouTube; detailed analytics report.
` : ""}
${additionalServices.includes("website_development") ? `
WEBSITE DEVELOPMENT (Framer):
- Copywriting focused on [their industry/niche — be specific]
- Design and development in Framer, complete content structure, responsive optimization, essential SEO setup, form integration, up to 3 revision rounds
- Payment: 50% upfront / 25% after first version / 25% on final delivery
- Delivery: ~40 business days. Fee: $2,500–$3,900 (one-off). *Framer ~$30/mo not included.
` : ""}
${additionalServices.includes("brand_manual") ? `
BRAND MANUAL:
- Full brand identity system tailored to ${prospect}
- Logo system, color palette, typography, stationery, digital templates
- Brand usage guidelines
- Delivery: ~15 business days. Fee: $1,500 (essentials visual system) or $6,000 (full manual).
` : ""}
${customService ? `
CUSTOM SERVICE — "${customService}":
- Generate 3–5 relevant deliverable bullets and a realistic timeline
` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEE STRUCTURE — pricing tiers from real proposals
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Monthly retainer ranges (use only if price not provided):
- LinkedIn only (no brand phase): $1,500/mo
- Full Stack Essential (Phase 1 + 4-item LinkedIn): $1,750–$1,900/mo
- Full Stack Essentials (Phase 1 + 9-item expanded strategy + LinkedIn): $2,100–$2,500/mo
- Premium scope (elevated content volume, newsletter, named exec): $2,500–$3,750/mo
Minimum term: "minimum 3 mo" (standard) — adjust to "minimum 4 mo" or "minimum 6 months" for larger scopes.
Format: "PLAN NAME: $X USD / mo\nOptimal Execution Plan: 6 months (minimum X mo).\nONE-OFF ITEMS:\n- [Item]: $X USD"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLOSING NOTE — Leo's exact 4-sentence formula
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Always 4 sentences. Adapt each to the prospect's specific situation:

Sentence 1 — trigger + value prop:
${hasNotes || hasWebsite ? `Use a specific trigger phrase based on what you know about them. Real examples: "Given you are currently raising capital..." / "Given you are currently building up the firm..." / "Given your current gaps and expansion roadmap..." / "Given the current market opportunity in [their space]..."` : `"[Prospect name] would gain access to a unified solution center at a fraction of the traditional investment required."`}
Then: "[Prospect] would gain access to a unified solution center at a fraction of the traditional investment required."

Sentence 2 — capability: "[Prospect] would acquire all capabilities under a single umbrella, eliminating the need to hire additional internal senior personnel who would still require complementary expertise to develop our advanced value proposition."

Sentence 3 — pricing: "We're offering industry-leading expertise at the most competitive pricing in the market." (slight variation allowed: "fee structure" instead of "pricing", or add "in [their sector]")

Sentence 4 — future: "By month [4 or 5], we project optimal positioning to implement additional high-impact initiatives that will significantly strengthen [Prospect]'s market presence." (use month 4 for smaller scopes, month 5 for full stack)

Spanish version uses the same structure in Spanish.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTELLIGENCE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Tailor every line to the prospect's industry, audience, and context. Never copy-paste generic bullets.
2. ${hasWebsite ? "Use scraped website content for specific references — their actual target audience, sector, products." : hasNotes ? "Use the notes provided as the primary source for tailoring." : "Limited context — keep content accurate to asset/wealth management, not invented specifics."}
3. Do NOT invent specific numbers (AUM, headcount, returns) unless explicitly provided.
4. Vary bullet wording intelligently. "Brand voice and messaging guidelines" can become "Brand voice and messaging guidelines addressing [specific gap from their context]" when context is available.
5. The STRUCTURE is fixed. The CONTENT within that structure should be prospect-specific.`;

  // ── USER PROMPT ──────────────────────────────────────────────────────────
  const websiteSection = websiteContent
    ? `\nSCRAPED WEBSITE (use for specific tailoring):\n---\n${websiteContent.slice(0, 3000)}\n---`
    : formData.websiteUrl
    ? `\nWebsite: ${formData.websiteUrl} (could not be scraped)`
    : "";

  const userPrompt = `Generate a proposal for:

Prospect: ${prospect}
Website: ${formData.websiteUrl || "Not provided"}
LinkedIn: ${formData.linkedinUrl || "Not provided"}
Profile: ${formData.prospectProfile ? profileDescriptions[formData.prospectProfile] : "Not specified"}
Services: ${allServices.join(" | ")}
Notes / pain points: ${formData.notes?.trim() || "None provided"}
Monthly investment: ${formData.suggestedPrice ? `$${formData.suggestedPrice} USD/mo` : "Not specified — pick from pricing tiers"}
${websiteSection}

Generate XML tags: ${requiredTags.join(", ")}`;

  return JSON.stringify({ system: systemPrompt, user: userPrompt });
}

// ─── API route ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const formData = body as ProposalFormData;

    if (!formData.prospectName) {
      return NextResponse.json({ error: "Prospect name is required" }, { status: 400 });
    }

    const websiteContent = formData.websiteUrl
      ? await scrapeWebsite(formData.websiteUrl)
      : null;

    const { system: systemPrompt, user: userPrompt } = JSON.parse(
      buildPrompt(formData, websiteContent)
    );

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawContent =
      message.content[0].type === "text" ? message.content[0].text : "";

    function extractTag(tag: string): string {
      const match = rawContent.match(
        new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i")
      );
      return match ? match[1].trim() : "";
    }

    const content = {
      phase1: extractTag("PHASE1") || extractTag("FASE1"),
      phase2: extractTag("PHASE2") || extractTag("FASE2"),
      additional: extractTag("ADDITIONAL"),
      feeStructure: extractTag("FEE_STRUCTURE"),
      closingNote: extractTag("CLOSING_NOTE"),
    };

    const { needsBrand, needsLinkedIn } = deriveSections(formData);

    return NextResponse.json({
      template: needsBrand && needsLinkedIn ? "B" : "A",
      content,
      formData,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Proposal generation error:", error);
    return NextResponse.json({ error: "Failed to generate proposal" }, { status: 500 });
  }
}
