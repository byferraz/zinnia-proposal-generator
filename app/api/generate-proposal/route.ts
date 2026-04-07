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
FORMAT RULES — non-negotiable
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Every list item MUST start with "- " (dash + space). No exceptions.
- Section titles, context sentences, delivery lines, fee lines: do NOT start with "- ".
- Never use "•", "*", "–", or numbered lists.
- Concise. Each bullet is 1 line. No long paragraphs.
- Timelines on every section: "~10 business days", "ongoing implementation", etc.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW LEO WRITES — from 37+ real proposals
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Leo's output feels written for this specific company, not copy-pasted. The difference is:

SPECIFICITY IN PHASE 1:
- The audience line always names the EXACT target: "tailored to wealth managers, family offices, and private wealth investors" not "tailored to investors"
- One bullet always references a specific competitive differentiator or positioning angle: "private credit market positioning framework distinguishing [Prospect] from traditional lenders", "brand perception framework emphasizing risk mitigation", "messaging addressing mixed positioning on website"
- If the prospect has any notable presence/strength, reference it: "LinkedIn company profile alignment building on existing institutional credibility"

SPECIFICITY IN PHASE 2 CONTEXT PARAGRAPH:
- Always: "LinkedIn is where 95% of [EXACT target audience] research [their specific topic] and evaluate [what they evaluate]."
- Always add a second sentence about the prospect's CURRENT STATE vs OPPORTUNITY — use specific details if available: "[Prospect] currently has [gap], but [their strength/opportunity]." Examples: "Seven Stars has a compelling differentiation story — precedent-based claims and £380M+ deployed — but lacks the digital presence to reach decision-makers." / "Balqis Capital currently has minimal digital presence in a space where credibility and thought leadership drive capital allocation decisions."
- If no specific metrics available: contrast industry moment with prospect's opportunity.

SPECIFICITY IN IMPLEMENTATION BULLETS:
- Add 1–2 content theme bullets specific to their industry. Not just "7 monthly posts" — write "7 monthly posts focused on [their specific content pillars]". Examples: "firm positioning, private credit education, and market insights" / "litigation finance insights and market education" / "developments, market insights, and company milestones"
- Adjust volume based on account type: standard = 7 posts / 1 video; high-content brands (real estate, multimedia) = 9-10 posts / 2 videos.
- Add "1 monthly briefing newsletter for [specific audience]" when relevant (investor relations, institutional clients, etc.)

CLOSING NOTE — Leo's exact formula (3–4 sentences):
1. [Specific strength or achievement of the prospect] + [current gap or challenge they face]
2. [Why Zinnia as single integrated partner is better than alternatives: multiple vendors / hiring internally / fragmented approach]
3. [Forward-looking outcome — specific to their goals, NOT a generic month number]
Real examples:
- "Seven Stars has built an exceptional track record with £380M+ deployed and zero defaults — a rare achievement in litigation finance that target investors need to discover. The challenge is positioning against decision-makers in alternative investments to learn your story. Working with Zinnia as your integrated partner means consistent, professional presence reaching the right investors with the right message. Within 6 months, Seven Stars will be positioned as the go-to precedent-based litigation funding opportunity for investors seeking uncorrelated, predictable returns."
- "Acorn's three decades of award-winning developments positions you perfectly for scaled digital growth, but fragmented marketing efforts won't capture the premium buyers and investors actively researching on LinkedIn. Working with Zinnia as your integrated partner means one strategic vision executed consistently across brand positioning and digital presence, no coordination gaps, no mixed messaging. Your established portfolio and pipeline deserve marketing execution that matches the caliber of your developments."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${needsBrand ? `
PHASE 1: ESSENTIAL BRAND STRATEGY ALIGNMENT
- 3–5 bullets, specific to this prospect's industry and context
- Opening bullet always: "Strategic brand communication guide tailored to [exact target audience description]"
- Middle bullets: 1–2 deliverable bullets adapted to their situation (messaging guidelines, visual system, perception assessment, LinkedIn profile alignment, competitive differentiation framework, etc.)
- Optional: "Integral visual system incl. LinkedIn wallpaper & email signature" if they lack visual identity
- Optional: "LinkedIn corporate profile optimization" or "LinkedIn profile alignment and optimization" when relevant
- Close: "Estimated time of delivery: ~10 business days from kick-off date (incl. revision)."
` : ""}
${needsLinkedIn ? `
PHASE 2: ${prospect.toUpperCase()}'S POSITIONING – LINKEDIN ESSENTIALS
[Context paragraph — 2 sentences, specific to this prospect. See HOW LEO WRITES above.]

${needsExpandedStrategy ? "TAILORED MARKETING STRATEGY & PLAN" : "TAILORED LINKEDIN STRATEGY & PLAN"}
Executive presentation including:
- ${needsExpandedStrategy ? "Scope, channels, and desired outcomes" : "Positioning & Messaging (Core value prop, key differentiations)"}
- ${needsExpandedStrategy ? "Strategic target audience segmentation" : "Positioning plan"}
- ${needsExpandedStrategy ? "Positioning and messaging strategy (incl. digital behaviour)" : "Content & Thought leadership strategy (incl. Strategic content calendar)"}
- ${needsExpandedStrategy ? "Positioning plan" : "Performance metrics & optimization"}
${needsExpandedStrategy ? `- Content and thought leadership strategy
- Digital marketing and distribution channels
- Conversion funnel mapping
- Action plan and roadmap
- Performance metrics and optimization framework` : ""}
Estimated time of delivery: ${needsExpandedStrategy ? "~20 business days" : "10 business days"} since kick-off date of this phase incl Q&A phase.

STRATEGIC MARKETING & CONTENT DEVELOPMENT IMPLEMENTATION & OPTIMIZATION
Management and Execution of Content and Design:
- Management of LinkedIn (Posting & monitoring)
- Optimization of posts based on performance
- Monthly executive dashboard with key metrics [adapt wording: "incl. insights and engagement metrics", "with audience insights", etc.]
- [X] monthly posts focused on [specific content pillars for this industry] [X = 7 standard; 8–10 for high-content brands like real estate, multimedia]
- [1 or 2] standard short-form video${needsExpandedStrategy ? "s" : ""} (mini-reel${needsExpandedStrategy ? "s" : ""}) [use 2 for high-content brands]
- 1 monthly article or blog (raw info provided by ${prospect})
[Add if investor/institutional model: - 1 monthly briefing newsletter for [specific audience]]
Estimated time of delivery: ongoing implementation.
` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADDITIONAL SERVICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${additionalServices.includes("one_pager") ? `
ONE PAGER / TEASER DEVELOPMENT
- Teaser (One Pager): strategic content & design tailored to [what this teaser is FOR — investor pitch, fund profile, product intro, company overview — be specific]
- Objective: Build an investor & commercial ready one pager to kick-start conversation with [specific target audience for this prospect]
- Estimated time of delivery: ~10 business days from kick-off date (incl. revision)
[Fee: $750 standard; $500 if simple; up to $1,000 if complex/two-pager scope]
` : ""}
${additionalServices.includes("executive_positioning") ? `
EXECUTIVE POSITIONING (INDIVIDUAL)
- Personal brand strategy for key executive at ${prospect}
- LinkedIn profile optimization tailored to their role and target audience in [their sector]
- Individual thought leadership positioning framework in [their specific sector/niche]
- Monthly content: 4–6 LinkedIn posts + 1 article (adapt volume to scope)
- Monthly strategy check-in
- Estimated time of delivery: ~7 business days from kick-off.
[Fee: $650–$900/mo depending on scope]
` : ""}
${additionalServices.includes("media_amplification") ? `
ZINNIA MEDIA AMPLIFICATION
We record ${prospect}'s professional interview showcasing your unique expertise, publish it on our platforms, and promote it with a paid ads strategy so thousands of ultra-segmented professionals from your sector see it. The result: Your message reaches decision-makers, not just your current followers.
Option 1 — Essential ($1,000): 30-day campaign; 3 edited reels; 30-day LinkedIn Ads; 30k–40k professional reach; sector-specific targeting; results report.
Option 2 — Essential+ ($1,800): 60-day campaign; 3 edited reels; 60-day LinkedIn Ads; ~70k–90k reach; LinkedIn + YouTube; detailed analytics report.
` : ""}
${additionalServices.includes("website_development") ? `
WEBSITE DEVELOPMENT (Framer)
- Copywriting focused on [their specific industry niche — be precise]
- Design and development in Framer: complete content structure, responsive optimization, essential SEO setup, form integration, up to 3 revision rounds
- Payment: 50% upfront / 25% after first version / 25% on final delivery
- Estimated time of delivery: ~40 business days.
[Fee: $2,500–$3,900 one-off. *Framer hosting ~$30/mo not included.]
` : ""}
${additionalServices.includes("brand_manual") ? `
BRAND MANUAL
- Full brand identity system tailored to ${prospect}
- Logo system, color palette, typography, stationery, digital templates
- Brand usage guidelines
- Estimated time of delivery: ~15 business days.
[Fee: $1,500 essentials visual system or $6,000 full manual]
` : ""}
${customService ? `
${customService.toUpperCase()}
- Generate 3–5 specific deliverable bullets relevant to this service and ${prospect}'s context
- Realistic delivery timeline
- Appropriate fee estimate
` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEE STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Monthly retainer (use only if not specified):
- LinkedIn only: $1,500/mo
- Full Stack (Phase 1 + 4-item plan): $1,750–$1,900/mo
- Full Stack (Phase 1 + expanded 9-item strategy): $2,100–$2,500/mo
- Premium scope (high volume, newsletter, executive positioning): $2,500–$3,750/mo
Minimum term: 3 mo standard; 4 mo for mid-large scope; 6 months for full enterprise.
Plan name: "FULL STACK ESSENTIALS (Phase 1 + 2)" or "FULL STACK PLAN (Incl. Phase 1 + 2)" — vary slightly.
Format:
[PLAN NAME]: $X USD / mo
Optimal Execution Plan: 6 months (minimum X mo).
ONE-OFF ITEMS:
- [Item]: $X USD

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTELLIGENCE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ${hasWebsite ? "You have scraped website content — use it. Reference their actual target audience, sector, products, and any distinguishing language from their site." : hasNotes ? "Use the notes/pain points as primary source for tailoring. Reference them directly in Phase 2 context and closing." : "Limited context — infer from the prospect name and profile. Keep claims accurate to asset/wealth management, never invent specifics."}
2. Do NOT invent specific numbers (AUM, returns, headcount, transaction counts) unless provided in notes or website content.
3. Every proposal should feel written for this company. If two lines could appear in any proposal, rewrite them to be specific.
4. The STRUCTURE is fixed. The CONTENT within that structure should be prospect-specific.`;

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
