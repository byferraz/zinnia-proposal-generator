import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { ProposalFormData } from "@/types/proposal";
import { scrapeWebsite } from "@/lib/scrapeWebsite";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getTemplate(
  profile: ProposalFormData["prospectProfile"],
  language: ProposalFormData["language"]
): "A" | "B" | "C" {
  if (language === "spanish") return "C";
  if (profile === "no_digital_presence") return "A";
  return "B";
}

const SERVICE_LABELS: Record<string, string> = {
  linkedin_management: "LinkedIn Management (Essential)",
  full_stack: "Full Stack (Brand + LinkedIn)",
  marketing_strategy: "Tailored Marketing Strategy & Plan",
  website_development: "Website Development",
  executive_positioning: "Executive Positioning (individual)",
  one_pager: "One Pager / Teaser",
  brand_manual: "Brand Manual",
  media_amplification: "Zinnia Media Amplification",
};

// Real proposal examples for reference:
// AlphaCircle: Phase 1 (brand guide) → Phase 2 (LinkedIn strategy + content mgmt) → Fee: $1,900/mo + Teaser $500
// Anchor: same structure → Fee: $1,750/mo + Teaser $450
// JX (Building Foundations): same → Fee: $2,700/mo + Teasers $800 each
// Key: SHORT, bullet-point driven, specific timelines, no narrative fluff

function buildSystemPrompt(template: "A" | "B" | "C"): string {
  const realExampleEnglish = `
REAL EXAMPLE (from actual Zinnia proposals — match this style exactly):

PHASE 1: ESSENTIAL BRAND STRATEGY ALIGNMENT
- Strategic brand communication guide tailored to institutional allocators and family offices
- Brand voice and messaging guidelines
- Brand style guide development
Estimated time of delivery: ~10 business days from kick-off date (incl. revision).

PHASE 2: [PROSPECT NAME]'s POSITIONING – LINKEDIN ESSENTIALS
Context strategy: LinkedIn is where 95% of asset & wealth management decision-makers learn, research, and consume content. We need to start with brand awareness stage.

TAILORED LINKEDIN STRATEGY & PLAN
Executive presentation including:
- Positioning & Messaging (Core value prop, key differentiations)
- Positioning plan
- Content & Thought leadership strategy (incl. Strategic content calendar)
- Performance metrics & optimization
Estimated time of delivery: 10 business days since kick-off date of this phase incl Q&A phase.

STRATEGIC MARKETING & CONTENT DEVELOPMENT IMPLEMENTATION & OPTIMIZATION
- Management and Execution of Content and Design
- Management of LinkedIn (Posting & monitoring)
- Optimization of posts based on performance
- Integral management with customized dashboards with key metrics
- 7 monthly pieces for LinkedIn posts
- 1 standard short-form video (mini-reel)
- 1 monthly article or blog
Estimated time of delivery: ongoing implementation.

FEE STRUCTURE:
FULL STACK ESSENTIAL PLAN (1 + 2): [PRICE] USD / mo
Optimal Execution Plan: 6 months (minimum 3 mo).`;

  const base = `You are Leo Hsu, CEO of Zinnia Group (zinniagroup.io), specialized in asset & wealth management marketing.

CRITICAL RULES:
- Be CONCISE. Real proposals are 1-2 pages. No long paragraphs.
- Use bullet points for all deliverables
- Include specific timelines ("~10 business days", "ongoing")
- Reference the prospect's name directly in Phase 2 title
- Fee structure must be clear: "PLAN NAME: $X USD / mo" + minimum term
- Add one-off items (One Pager, etc.) separately with their price
- NO generic filler. Every line must be specific and useful.
- ONLY include services that were selected by the user
- Return ONLY XML tags as specified. No preamble.

${realExampleEnglish}`;

  if (template === "A") {
    return `${base}

Use Template A — "Building the Foundations". Return:
<PHASE1>Phase 1: Essential Brand Strategy Alignment — bullet list of deliverables + timeline. Max 8 lines.</PHASE1>
<PHASE2>Phase 2: [Prospect name]'s Positioning – LinkedIn Essentials — context sentence, then TAILORED LINKEDIN STRATEGY & PLAN section with bullets, then STRATEGIC MARKETING & CONTENT DEVELOPMENT section with bullets. Include specific monthly deliverables (X posts, X videos, etc.) based on selected services. Include timeline.</PHASE2>
<ADDITIONAL>Any additional one-off services selected (One Pager, Brand Manual, Website, Media Amplification, Executive Positioning). Each with brief description and timeline. Leave empty if none.</ADDITIONAL>
<FEE_STRUCTURE>FULL STACK ESSENTIAL PLAN (1 + 2): [price] USD / mo — Optimal Execution Plan: 6 months (minimum X mo). Then list any one-off items with price. Keep it short and scannable.</FEE_STRUCTURE>
<CLOSING_NOTE>1-2 sentences max. A specific, confident closing statement about why now is the right time. No generic fluff.</CLOSING_NOTE>`;
  }

  if (template === "B") {
    return `${base}

Use Template B — "Full Stack". Same structure but include all selected phases. Return:
<PHASE1>Phase 1: Essential Brand Strategy Alignment — bullet list of deliverables + timeline.</PHASE1>
<PHASE2>Phase 2: [Prospect name]'s Positioning – LinkedIn Essentials — same structure as Template A Phase 2.</PHASE2>
<ADDITIONAL>Any additional selected services (Marketing Strategy, One Pager, Brand Manual, Website, Media Amplification, Executive Positioning). Each with brief description and timeline. Leave empty if none.</ADDITIONAL>
<FEE_STRUCTURE>Fee breakdown. Monthly plan name + price + term. One-off items listed separately.</FEE_STRUCTURE>
<CLOSING_NOTE>1-2 sentences. Specific and confident.</CLOSING_NOTE>`;
  }

  // Template C — Spanish
  return `${base}

Use Template C — Spanish language. Write EVERYTHING in Spanish. Use the same concise, bullet-driven format.

Return:
<PHASE1>Fase 1: Alineación Estratégica de Marca — lista de entregables + tiempos. Máximo 8 líneas.</PHASE1>
<PHASE2>Fase 2: Posicionamiento de [Nombre] – LinkedIn Essentials — misma estructura que Template A Fase 2 pero en español.</PHASE2>
<ADDITIONAL>Servicios adicionales seleccionados (One Pager, etc.) con descripción breve y tiempo. Vacío si no hay ninguno.</ADDITIONAL>
<FEE_STRUCTURE>Estructura de honorarios: plan mensual + precio + plazo. Items one-off separados.</FEE_STRUCTURE>
<CLOSING_NOTE>1-2 oraciones de cierre. Específico y directo.</CLOSING_NOTE>`;
}

function buildUserPrompt(formData: ProposalFormData, websiteContent: string | null): string {
  const serviceList = [
    ...formData.services.map((s) => `- ${SERVICE_LABELS[s]}`),
    ...(formData.customService?.trim() ? [`- ${formData.customService.trim()} (custom)`] : []),
  ].join("\n");

  const websiteSection = websiteContent
    ? `\nWebsite content (scraped — use for specific references):\n${websiteContent}`
    : formData.websiteUrl
    ? "\n(Website could not be scraped)"
    : "";

  return `Generate a proposal for:

Prospect: ${formData.prospectName}
Website: ${formData.websiteUrl || "Not provided"}
LinkedIn: ${formData.linkedinUrl || "Not provided"}
Profile: ${formData.prospectProfile}
Language: ${formData.language}
${websiteSection}

Services selected (ONLY include these):
${serviceList}

Notes / pain points:
${formData.notes || "None"}

Suggested monthly investment: ${formData.suggestedPrice ? `$${formData.suggestedPrice} USD/mo` : "Not specified — pick a reasonable price based on scope"}

Match the concise, professional style of real Zinnia proposals. Name the prospect directly. If website content was provided, reference 1-2 specific things about their current presence.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const formData = body as ProposalFormData;

    if (!formData.prospectName) {
      return NextResponse.json(
        { error: "Prospect name is required" },
        { status: 400 }
      );
    }

    const template = getTemplate(formData.prospectProfile, formData.language);
    const systemPrompt = buildSystemPrompt(template);

    // Scrape prospect's website for real context (LinkedIn is skipped — blocked)
    const websiteContent = formData.websiteUrl
      ? await scrapeWebsite(formData.websiteUrl)
      : null;

    const userPrompt = buildUserPrompt(formData, websiteContent);

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
      phase1: extractTag("PHASE1"),
      phase2: extractTag("PHASE2"),
      additional: extractTag("ADDITIONAL"),
      feeStructure: extractTag("FEE_STRUCTURE"),
      closingNote: extractTag("CLOSING_NOTE"),
    };

    return NextResponse.json({
      template,
      content,
      formData,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Proposal generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate proposal" },
      { status: 500 }
    );
  }
}
