import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { ProposalFormData } from "@/types/proposal";

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

const PROFILE_LABELS: Record<string, string> = {
  no_digital_presence: "No structured digital presence",
  basic_presence: "Basic established presence, looking to scale",
  solid_presence: "Solid presence, seeking dominance",
};

function buildSystemPrompt(template: "A" | "B" | "C"): string {
  const baseInstructions = `You are Leo Hsu, CEO of Zinnia Group (zinniagroup.io), a digital marketing agency specialized in asset & wealth management. You write compelling, professional business proposals for prospects.

Your writing style is:
- Confident and direct — no fluff
- Shows deep understanding of wealth management industry challenges
- Positions Zinnia as the strategic partner, not just a vendor
- Uses specific, tangible language about outcomes and ROI
- Concise but comprehensive

IMPORTANT: Return ONLY the proposal content structured with XML tags as specified. Do not add any preamble, explanation, or commentary outside the XML tags.`;

  if (template === "A") {
    return `${baseInstructions}

Use Template A — "Building the Foundations" for prospects with no structured digital presence.

Return the content using these XML tags:
<GAPS>Main gaps and missed opportunities — 3-4 specific gaps relevant to the prospect. Write 2-3 sentences each. Be specific to their industry and situation.</GAPS>
<PHASE1>Phase 1: Essential Brand Strategy Alignment — describe deliverables, timeline, and expected outcomes. Use bullet points for deliverables.</PHASE1>
<PHASE2>Phase 2: LinkedIn Positioning Essentials — describe deliverables, timeline, and expected outcomes. Use bullet points for deliverables.</PHASE2>
<FEE_STRUCTURE>Investment structure with monthly retainer and what's included. Reference the suggested price if provided.</FEE_STRUCTURE>
<ABOUT_ZINNIA>2-paragraph about Zinnia Group — our specialization in asset & wealth management, our approach, and why we're the right partner.</ABOUT_ZINNIA>`;
  }

  if (template === "B") {
    return `${baseInstructions}

Use Template B — "Full Stack" for prospects with basic presence who want to scale.

Return the content using these XML tags:
<CHALLENGES>Main Challenges & Gaps — 3-4 specific challenges relevant to the prospect. Write 2-3 sentences each. Be specific to their situation and growth stage.</CHALLENGES>
<BRAND_STRATEGY>Brand Strategy Alignment — describe the brand audit, positioning work, and ICP definition. Use bullet points for deliverables.</BRAND_STRATEGY>
<MARKETING_PLAN>Tailored Marketing Strategy & Plan — describe the strategic marketing plan components. Use bullet points for deliverables.</MARKETING_PLAN>
<LINKEDIN_PLAN>LinkedIn Implementation & Optimization — describe the LinkedIn strategy and execution plan. Use bullet points for deliverables.</LINKEDIN_PLAN>
<FEE_STRUCTURE>Investment structure with monthly retainer and what's included. Reference the suggested price if provided.</FEE_STRUCTURE>
<ABOUT_ZINNIA>2-paragraph about Zinnia Group — our specialization in asset & wealth management, our approach, and why we're the right partner.</ABOUT_ZINNIA>`;
  }

  // Template C — Spanish
  return `${baseInstructions}

Use Template C — "Atraer / Nutrir / Convertir" for Spanish-language proposals. Write EVERYTHING in Spanish.

Return the content using these XML tags:
<CHALLENGES>Desafíos y puntos de dolor — 3-4 desafíos específicos del prospecto. 2-3 oraciones cada uno. Sé específico a su situación.</CHALLENGES>
<ATTRACT>ATRAER — estrategia y entregables para atraer el perfil ideal de cliente. Usa viñetas para los entregables.</ATTRACT>
<NURTURE>NUTRIR — estrategia y entregables para nutrir y educar a los prospectos. Usa viñetas para los entregables.</NURTURE>
<CONVERT>CONVERTIR — estrategia y entregables para convertir prospectos en clientes. Usa viñetas para los entregables.</CONVERT>
<FEE_STRUCTURE>Estructura de honorarios con retainer mensual y qué incluye. Referencia el precio sugerido si se proporciona.</FEE_STRUCTURE>
<ABOUT_ZINNIA>2 párrafos sobre Zinnia Group — nuestra especialización en asset & wealth management, nuestro enfoque, y por qué somos el socio adecuado. En español.</ABOUT_ZINNIA>`;
}

function buildUserPrompt(formData: ProposalFormData): string {
  const serviceList = formData.services
    .map((s) => `- ${SERVICE_LABELS[s]}`)
    .join("\n");

  return `Generate a proposal for the following prospect:

**Prospect:** ${formData.prospectName}
**Website:** ${formData.websiteUrl || "Not provided"}
**LinkedIn:** ${formData.linkedinUrl || "Not provided"}
**Profile:** ${PROFILE_LABELS[formData.prospectProfile]}
**Language:** ${formData.language === "english" ? "English" : "Spanish"}

**Services to include:**
${serviceList}

**Additional notes / pain points detected:**
${formData.notes || "None provided"}

**Suggested monthly investment:** ${formData.suggestedPrice ? `$${formData.suggestedPrice} USD/mo` : "Not specified"}

Generate a compelling, tailored proposal based on this information. Make it specific to ${formData.prospectName} — reference their website/LinkedIn context where relevant. The fee structure should reference the suggested price naturally.`;
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
    const userPrompt = buildUserPrompt(formData);

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
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

    const content =
      template === "A"
        ? {
            gaps: extractTag("GAPS"),
            phase1: extractTag("PHASE1"),
            phase2: extractTag("PHASE2"),
            feeStructure: extractTag("FEE_STRUCTURE"),
            aboutZinnia: extractTag("ABOUT_ZINNIA"),
          }
        : template === "B"
          ? {
              challenges: extractTag("CHALLENGES"),
              brandStrategy: extractTag("BRAND_STRATEGY"),
              marketingPlan: extractTag("MARKETING_PLAN"),
              linkedinPlan: extractTag("LINKEDIN_PLAN"),
              feeStructure: extractTag("FEE_STRUCTURE"),
              aboutZinnia: extractTag("ABOUT_ZINNIA"),
            }
          : {
              challenges: extractTag("CHALLENGES"),
              attract: extractTag("ATTRACT"),
              nurture: extractTag("NURTURE"),
              convert: extractTag("CONVERT"),
              feeStructure: extractTag("FEE_STRUCTURE"),
              aboutZinnia: extractTag("ABOUT_ZINNIA"),
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
