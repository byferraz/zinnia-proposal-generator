import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { ProposalFormData } from "@/types/proposal";
import { scrapeWebsite } from "@/lib/scrapeWebsite";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Service groupings ────────────────────────────────────────────────────────
const BRAND_SERVICES = new Set([
  "full_stack", "linkedin_management", "brand_manual", "marketing_strategy",
]);
const LINKEDIN_SERVICES = new Set([
  "full_stack", "linkedin_management", "marketing_strategy",
]);
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
  const hasProfile = !!formData.prospectProfile;

  const lang = isSpanish ? "Spanish" : "English";

  // Derive the required XML tags
  const requiredTags: string[] = [];
  if (needsBrand) requiredTags.push("PHASE1");
  if (needsLinkedIn) requiredTags.push("PHASE2");
  if (additionalServices.length > 0 || customService || !hasCore) requiredTags.push("ADDITIONAL");
  requiredTags.push("FEE_STRUCTURE");
  requiredTags.push("CLOSING_NOTE");

  // ── SYSTEM PROMPT with exact Leo templates ───────────────────────────────
  const systemPrompt = `You are helping generate a Zinnia Group commercial proposal.
Write everything in ${lang}.
Return ONLY the XML tags listed. No preamble, no explanation, no markdown outside the tags.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEO'S EXACT TEMPLATES — follow wording precisely
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${needsBrand ? `
▸ PHASE1 template (use EXACT sub-bullets, only change the [QUALIFIER] line):

${isSpanish ? `FASE 1: ALINEACIÓN ESTRATÉGICA DE MARCA
- Guía de comunicación de marca estratégica [QUALIFIER — based on client's target audience/context, e.g. "orientada a inversores institucionales y family offices"]
  - Lineamientos de voz y mensajes de marca
  - Desarrollo de guía de estilo de marca
Estimated time of delivery: ~10 días hábiles desde el kick-off (incl. revisión).` : `PHASE 1: ESSENTIAL BRAND STRATEGY ALIGNMENT
- Strategic brand communication guide [QUALIFIER — e.g. "tailored to institutional allocators and family offices" / "tailored to internationalize the firm" / "tailored for the private wealth segment" / "tailored to grow the [unit] unit" / "customized to [specific context]"]
  - Brand voice and messaging guidelines
  - Brand style guide development
Estimated time of delivery: ~10 business days from kick-off date (incl. revision).`}

QUALIFIER examples from real proposals (pick the most accurate for this prospect):
- "tailored to institutional allocators and family offices" (asset managers)
- "tailored to institutional investors and family offices" (similar)
- "tailored to internationalize the firm" (LATAM firms expanding to US/Europe)
- "tailored to internationalize the firm & position against small-mid size managers" (competitive positioning)
- "tailored for the private wealth segment" (wealth managers, RIAs)
- "tailored to grow the private wealth unit" (large firms with a specific unit)
- "tailored to enhance brand equity and the positioning of the business units" (holding companies)
- "customized to the international expansion (US, UK, etc)" (fintech/SaaS expanding)
- "tailored to position the asset & wealth management business" (generic AM)
If no specific context → use "tailored to [prospect]'s target audience and positioning objectives"
` : ""}

${needsLinkedIn ? `
▸ PHASE2 template — TWO BLOCKS (use EXACT wording):

${needsExpandedStrategy ? `
PHASE 2: ${prospect}'S POSITIONING – LINKEDIN ESSENTIALS
Context strategy: LinkedIn is where 95% of [target audience specific to this prospect] learn, research, and consume content. [1 sentence about their current situation/opportunity].

TAILORED MARKETING STRATEGY & PLAN
Executive presentation including:
- Scope, Channels and desired outcome
- Strategic definition of target audience
- Positioning & Messaging (Core value prop, key differentiations, target audience digital behaviour)
- Positioning plan
- Content & Thought leadership strategy (incl. Strategic content calendar)
- Digital marketing & Distribution channels
- Ideal conversion funnel mapping and strategy (Growth)
- Action plan and implementation roadmap
- Performance metrics & optimization
Estimated time of delivery: ~20 business days since kick-off date of this phase incl Q&A phase.
` : `
PHASE 2: ${prospect}'S POSITIONING – LINKEDIN ESSENTIALS
Context strategy: LinkedIn is where 95% of [target audience specific to this prospect] learn, research, and consume content. [1 sentence about their current situation/opportunity].

TAILORED LINKEDIN STRATEGY & PLAN
Executive presentation including:
- Positioning & Messaging (Core value prop, key differentiations)
- Positioning plan
- Content & Thought leadership strategy (incl. Strategic content calendar)
- Performance metrics & optimization
Estimated time of delivery: 10 business days since kick-off date of this phase incl Q&A phase.
`}

STRATEGIC MARKETING & CONTENT DEVELOPMENT IMPLEMENTATION & OPTIMIZATION
Management and Execution of Content and Design:
- Management of LinkedIn (Posting & monitoring)
- Optimization of posts based on performance
- Integral management with customized dashboards with key metrics
- 7 monthly pieces for LinkedIn posts
- 1 standard short-form video (mini-reel)
- 1 monthly article or blog (raw info provided by ${prospect})
Estimated time of delivery: ongoing implementation.
` : ""}

${additionalServices.includes("one_pager") || customService?.toLowerCase().includes("pager") || customService?.toLowerCase().includes("teaser") ? `
▸ ONE PAGER / TEASER template:
Teaser (One Pager): including strategic content & design. Objective: Build an investor & commercial ready one pager to kick-start conversation with potential shareholders and strategic partners.
Estimated time of delivery: ~10 business days from kick-off.
` : ""}

${additionalServices.includes("executive_positioning") ? `
▸ EXECUTIVE POSITIONING template:
EXECUTIVE POSITIONING (INDIVIDUAL)
- Personal brand strategy for key executive
- LinkedIn profile optimization and content strategy
- Individual thought leadership positioning in [their sector]
- 5 monthly LinkedIn posts + 1 monthly article
- Monthly strategy check-in (30 min)
Estimated time of delivery: ~7 business days from kick-off.
` : ""}

${additionalServices.includes("media_amplification") ? `
▸ ZINNIA MEDIA AMPLIFICATION template (TWO OPTIONS):
ZINNIA MEDIA AMPLIFICATION
We record ${prospect}'s professional interview showcasing your unique expertise, publish it on our platforms, and promote it with a paid ads strategy so thousands of ultra-segmented professionals from your sector see it. The result: Your message reaches decision-makers, not just your current followers. We aim to position you as an authority in your field.

Option 1 — Essential: $1,000
- 30-day campaign
- 3 edited reels
- 30-day LinkedIn Ads
- Reach: 30,000–40,000 professionals
- Specific institutional & wealth sector targeting
- Results report

Option 2 — Essential+: $1,800
- Extended 60-day campaign
- 3 edited reels
- 60-day LinkedIn Ads
- Reach: ~70,000–90,000 professionals
- Amplification: LinkedIn + YouTube
- Detailed report with analytics

Estimated time of delivery: ongoing implementation.
` : ""}

${additionalServices.includes("website_development") ? `
▸ WEBSITE DEVELOPMENT template:
HOME WEB PAGE DEVELOPMENT (Framer*)
Design and development in Framer, the complete content structure, specialized copywriting focused on [their industry/niche], responsive optimization, essential SEO setup, form integration, and up to three rounds of revisions.
Estimated time of delivery: ~40 business days from kick-off.
*Framer tool is not incl. (~30 usd / mo)
Payment: 50% paid upfront, 25% after first version, 25% against final deliverable.
` : ""}

${additionalServices.includes("brand_manual") ? `
▸ BRAND MANUAL template:
BRAND MANUAL
Full brand identity system: logo system, color palette, typography, stationery, digital templates.
- Logo design (primary + variations)
- Color palette & typography system
- Brand voice and messaging guidelines
- Digital asset templates (LinkedIn wallpaper, email signature, presentation)
- Brand usage guidelines
Estimated time of delivery: ~15 business days from kick-off.
` : ""}

▸ CLOSING NOTE — TWO English templates (choose trigger based on context):

Template A — with trigger phrase (use when you know something specific about the prospect):
"Given [TRIGGER — e.g. "you are currently raising capital" / "you are currently building up the firm" / "your current gaps and expansion roadmap" / "the current market opportunity"], our conversation came with great timing, and in other words, ${prospect} would gain access to a unified solution center at a fraction of the traditional investment required. Additionally, ${prospect} would acquire all capabilities under a single umbrella, eliminating the need to hire additional internal senior personnel who would still require complementary expertise to develop our advanced value proposition. We're offering industry-leading expertise at the most competitive pricing in the market. By month [4 or 5], we project optimal positioning to implement additional high-impact initiatives that will significantly strengthen ${prospect}'s market presence."

Template B — no trigger (use when limited context):
"${prospect} would gain access to a unified solution center at a fraction of the traditional investment required. Additionally, ${prospect} would acquire all capabilities under a single umbrella, eliminating the need to hire additional internal senior personnel who would still require complementary expertise to develop our advanced value proposition. We're offering industry-leading expertise at the most competitive pricing in the market. By month 5, we project optimal positioning to implement additional high-impact initiatives that will significantly strengthen ${prospect}'s market presence."

Spanish template:
"Nuestra conversación llegó en el momento perfecto, y en otras palabras, ${prospect} obtendría acceso a un centro de soluciones unificado a una fracción del costo tradicional. Además, ${prospect} adquiriría todas las capacidades bajo un único paraguas, eliminando la necesidad de contratar personal senior interno adicional. Estamos ofreciendo experiencia líder en la industria a los precios más competitivos del mercado. Para el mes 5, proyectamos un posicionamiento óptimo para implementar iniciativas adicionales de alto impacto que fortalecerán significativamente la presencia de mercado de ${prospect}."

▸ PRICING GUIDANCE (use ONLY if price not specified):
- LinkedIn only (no brand): $1,500/mo
- Full Stack Essential (Phase 1 + 4-item LinkedIn strategy): $1,750–1,900/mo
- Full Stack Essentials (Phase 1 + 9-item marketing strategy + LinkedIn): $2,100–2,500/mo
- Premium scope (10+ posts, 2 reels, newsletter, elevated): $2,500–3,750/mo
- Minimum term: 3 months (standard) or 6 months (optimal)
- One Pager / Teaser: $500 (standard), $800–1,000 (premium)
- Executive Positioning (individual): $650–900/mo
- Website (Framer): $2,500–3,900 (one-off)
- Brand Manual (full): $6,000 (one-off)
- Media Amplification: $1,000 (Essential) / $1,800 (Essential+)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Follow templates EXACTLY. Do not rephrase the fixed bullets.
2. Only fill in the [VARIABLE] parts based on prospect context.
3. ${hasWebsite ? `Website was scraped — use specific industry/audience details from it for the QUALIFIER and context sentence.` : hasNotes ? "Use the notes provided for the trigger phrase and qualifiers." : "Limited context — use Template B for closing note, keep qualifiers generic but accurate."}
4. Do NOT invent specific numbers (AUM, headcount, returns) unless provided.
5. Return ONLY these XML tags: ${requiredTags.map((t) => `<${t}>`).join(", ")}`;

  // ── USER PROMPT ──────────────────────────────────────────────────────────
  const profileDescriptions: Record<string, string> = {
    no_digital_presence: "No digital presence — starting from scratch",
    basic_presence: "Basic/limited online presence",
    solid_presence: "Solid established presence — wants to scale",
  };

  const websiteSection = websiteContent
    ? `\nSCRAPED WEBSITE CONTENT (use for qualifiers and context):\n---\n${websiteContent.slice(0, 3000)}\n---`
    : formData.websiteUrl
    ? `\nWebsite: ${formData.websiteUrl} (could not be scraped)`
    : "";

  const allServices = [
    ...formData.services.map((s) => ALL_SERVICE_LABELS[s] || s),
    ...(customService ? [customService] : []),
  ];

  const userPrompt = `Generate a proposal for:

Prospect: ${prospect}
Website: ${formData.websiteUrl || "Not provided"}
LinkedIn: ${formData.linkedinUrl || "Not provided"}
Profile: ${formData.prospectProfile ? profileDescriptions[formData.prospectProfile] : "Not specified"}
Services selected: ${allServices.join(" | ")}
Notes / pain points: ${formData.notes?.trim() || "None"}
Monthly investment: ${formData.suggestedPrice ? `$${formData.suggestedPrice} USD/mo` : "Not specified — pick from pricing guidance"}
${websiteSection}

Fill in the templates for: ${requiredTags.join(", ")}`;

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
