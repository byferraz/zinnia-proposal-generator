import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { ProposalFormData } from "@/types/proposal";
import { scrapeWebsite } from "@/lib/scrapeWebsite";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Service groupings ────────────────────────────────────────────────────────
// Which services trigger a Brand Strategy section (Phase 1)
const BRAND_SERVICES = new Set([
  "full_stack",
  "linkedin_management",
  "brand_manual",
  "marketing_strategy",
]);

// Which services trigger a LinkedIn Positioning section (Phase 2)
const LINKEDIN_SERVICES = new Set([
  "full_stack",
  "linkedin_management",
  "marketing_strategy",
]);

// Services that go in the Additional section (with their display names)
const ADDITIONAL_SERVICE_LABELS: Record<string, string> = {
  executive_positioning: "Executive Positioning (Individual)",
  one_pager: "One Pager / Teaser Development",
  brand_manual: "Brand Manual",
  media_amplification: "Zinnia Media Amplification",
  website_development: "Website Development",
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

// ─── Derive which sections to generate ───────────────────────────────────────
function deriveSections(formData: ProposalFormData) {
  const services = formData.services;
  const isSpanish = formData.language === "spanish";

  const needsBrand = services.some((s) => BRAND_SERVICES.has(s));
  const needsLinkedIn = services.some((s) => LINKEDIN_SERVICES.has(s));
  const additionalServices = services.filter(
    (s) => ADDITIONAL_SERVICE_LABELS[s]
  );
  const customService = formData.customService?.trim();

  // If no brand/linkedin service, treat ALL selected services as additional
  const hasCore = needsBrand || needsLinkedIn;

  return {
    needsBrand,
    needsLinkedIn,
    additionalServices,
    customService,
    hasCore,
    isSpanish,
  };
}

// ─── Build dynamic system prompt ─────────────────────────────────────────────
function buildSystemPrompt(
  formData: ProposalFormData,
  websiteContent: string | null
): string {
  const { needsBrand, needsLinkedIn, additionalServices, customService, hasCore, isSpanish } =
    deriveSections(formData);

  const hasWebsiteData = !!websiteContent;
  const hasNotes = !!formData.notes?.trim();
  const hasProfile = !!formData.prospectProfile;
  const hasContext = hasWebsiteData || hasNotes || hasProfile;

  const lang = isSpanish ? "Spanish" : "English";
  const prospect = formData.prospectName;

  // ── Construct list of XML tags Claude must return ────────────────────────
  const requiredTags: string[] = [];
  if (needsBrand) requiredTags.push(isSpanish ? "FASE1" : "PHASE1");
  if (needsLinkedIn) requiredTags.push(isSpanish ? "FASE2" : "PHASE2");
  if (additionalServices.length > 0 || customService) requiredTags.push("ADDITIONAL");
  requiredTags.push("FEE_STRUCTURE");
  requiredTags.push("CLOSING_NOTE");

  // ── Instructions for each section ───────────────────────────────────────
  const sectionInstructions: string[] = [];

  if (needsBrand) {
    const tag = isSpanish ? "FASE1" : "PHASE1";
    const label = isSpanish
      ? "Fase 1: Alineación Estratégica de Marca"
      : "Phase 1: Essential Brand Strategy Alignment";
    sectionInstructions.push(
      `<${tag}> → ${label}
- 3-5 bullet points of concrete brand deliverables tailored to ${prospect}'s industry
- End with: "Estimated time of delivery: ~10 business days from kick-off date (incl. revision)."
- NO generic filler. Reference ${hasContext ? "the specific context provided" : "their industry and profile"}.
</${tag}>`
    );
  }

  if (needsLinkedIn) {
    const tag = isSpanish ? "FASE2" : "PHASE2";
    const label = isSpanish
      ? `Fase 2: Posicionamiento de ${prospect} – LinkedIn Essentials`
      : `Phase 2: ${prospect}'s Positioning – LinkedIn Essentials`;
    sectionInstructions.push(
      `<${tag}> → ${label}
Start with: "Context strategy: LinkedIn is where 95% of [their target audience] learn, research, and consume content."

Then two sub-blocks:

TAILORED LINKEDIN STRATEGY & PLAN
"Executive presentation including:"
- 4 bullets: Positioning & Messaging, Positioning plan, Content & Thought leadership strategy, Performance metrics & optimization
"Estimated time of delivery: 10 business days since kick-off date of this phase incl Q&A phase."

STRATEGIC MARKETING & CONTENT DEVELOPMENT IMPLEMENTATION & OPTIMIZATION
- Management and Execution of Content and Design
- Management of LinkedIn (Posting & monitoring)
- Optimization of posts based on performance
- Integral management with customized dashboards with key metrics
- 7 monthly pieces for LinkedIn posts
- 1 standard short-form video (mini-reel)
- 1 monthly article or blog
"Estimated time of delivery: ongoing implementation."
</${tag}>`
    );
  }

  // Additional services
  const additionalList = [
    ...additionalServices.map(
      (s) => `- ${ADDITIONAL_SERVICE_LABELS[s]} (3-4 bullets + timeline)`
    ),
    ...(customService ? [`- ${customService} (3-4 bullets + timeline)`] : []),
  ];
  if (additionalList.length > 0) {
    sectionInstructions.push(
      `<ADDITIONAL> → One section per additional service selected:
${additionalList.join("\n")}
Format each: BOLD SERVICE NAME + bullets + "Estimated time of delivery: X"
</ADDITIONAL>`
    );
  }

  // If no core (brand/linkedin) services and only additional — treat them all as main content
  if (!hasCore) {
    const allAsAdditional = formData.services
      .map((s) => `- ${ALL_SERVICE_LABELS[s] || s} (4-5 bullets of deliverables + timeline)`)
      .join("\n");
    sectionInstructions.push(
      `<ADDITIONAL> → Sections for each selected service:
${allAsAdditional}
${customService ? `- ${customService} (4-5 bullets + timeline)` : ""}
Format each as: BOLD SERVICE NAME + bullets + timeline.
</ADDITIONAL>`
    );
  }

  const planName = needsBrand && needsLinkedIn
    ? (isSpanish ? "PLAN FULL STACK ESENCIAL (1 + 2)" : "FULL STACK ESSENTIAL PLAN (1 + 2)")
    : needsLinkedIn
    ? (isSpanish ? "LINKEDIN MANAGEMENT ESENCIAL" : "LINKEDIN MANAGEMENT ESSENTIAL")
    : needsBrand
    ? (isSpanish ? "PLAN DE MARCA" : "BRAND STRATEGY PLAN")
    : "";

  const priceInstruction = formData.suggestedPrice
    ? `Monthly price is $${formData.suggestedPrice} USD/mo — use this exact number.`
    : "Choose a price appropriate to scope based on typical Zinnia pricing ($1,500–$3,500/mo range).";

  sectionInstructions.push(
    `<FEE_STRUCTURE> → Clear, scannable fee breakdown:
${planName ? `${planName}: [PRICE] USD / mo` : ""}
"Optimal Execution Plan: 6 months (minimum 3 mo)." (or minimum 1 mo if only one service)
ONE-OFF ITEMS: (only if applicable)
- List each additional service with its price (One Pager: $850–$1,200 / Executive Positioning: $700–$1,000 / Brand Manual: $1,500–$2,500)
${priceInstruction}
</FEE_STRUCTURE>`
  );

  sectionInstructions.push(
    `<CLOSING_NOTE> → 1-2 sentences MAX. Confident, specific, no fluff.
${hasContext ? "Reference something specific about the prospect from the context provided." : "Keep it general but compelling for their industry/profile."}
Example style: "${prospect} has the credentials to lead thought leadership in [their space]. We'll transform [specific gap] into a competitive advantage."
</CLOSING_NOTE>`
  );

  // ── Hallucination guard ──────────────────────────────────────────────────
  const hallucinationGuard = hasContext
    ? `You have context about ${prospect}. Use it. Reference specific details from their website, industry, or the notes provided. Do NOT invent numbers (AUM, clients, returns) that weren't mentioned.`
    : `You have LIMITED context about ${prospect}. Do NOT invent specific facts (AUM figures, client counts, market positions, track records). Use language that fits any firm in their space: "institutional investors", "HNW clients", "their target audience", etc. The proposal must still be professional and specific to the selected services.`;

  return `You are Leo Hsu, CEO of Zinnia Group (zinniagroup.io), a digital marketing agency specialized in asset & wealth management.

LANGUAGE: Write everything in ${lang}.

CRITICAL RULES:
1. CONCISE — real Zinnia proposals are 1-2 pages. Short bullets, no narrative paragraphs.
2. ONLY generate sections for the services actually selected. Do not add sections that weren't requested.
3. ${hallucinationGuard}
4. Use the prospect's name ${prospect} directly in section titles where appropriate.
5. Return ONLY the XML tags listed below. No preamble, no explanation.

REQUIRED OUTPUT — return ONLY these XML tags in this order:
${requiredTags.map((t) => `<${t}>...</${t}>`).join("\n")}

SECTION INSTRUCTIONS:
${sectionInstructions.join("\n\n")}`;
}

// ─── Build user prompt ────────────────────────────────────────────────────────
function buildUserPrompt(
  formData: ProposalFormData,
  websiteContent: string | null
): string {
  const services = [
    ...formData.services.map((s) => `• ${ALL_SERVICE_LABELS[s] || s}`),
    ...(formData.customService?.trim() ? [`• ${formData.customService.trim()} (custom)`] : []),
  ].join("\n");

  const profileDescriptions: Record<string, string> = {
    no_digital_presence: "No digital presence — starting from scratch",
    basic_presence: "Basic presence — has some online presence but limited or inconsistent",
    solid_presence: "Solid presence — established but wants to scale or improve",
  };

  const profileLine = formData.prospectProfile
    ? `Profile: ${profileDescriptions[formData.prospectProfile] || formData.prospectProfile}`
    : "Profile: Not specified";

  const websiteSection = websiteContent
    ? `\nWEBSITE CONTENT (scraped — use for specific, accurate references):\n---\n${websiteContent}\n---`
    : formData.websiteUrl
    ? `\nWebsite: ${formData.websiteUrl} (could not be scraped — do not invent content from it)`
    : "";

  return `Generate a proposal for:

Prospect: ${formData.prospectName}
${formData.websiteUrl ? `Website: ${formData.websiteUrl}` : "Website: Not provided"}
${formData.linkedinUrl ? `LinkedIn: ${formData.linkedinUrl}` : "LinkedIn: Not provided"}
${profileLine}
${websiteSection}

SERVICES SELECTED (generate ONLY for these):
${services || "⚠ No services selected — generate a brief placeholder proposal"}

Notes / pain points from Leo:
${formData.notes?.trim() || "None provided"}

Suggested monthly investment: ${
    formData.suggestedPrice
      ? `$${formData.suggestedPrice} USD/mo`
      : "Not specified — choose a price that fits the scope"
  }`;
}

// ─── API route ────────────────────────────────────────────────────────────────
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

    const websiteContent = formData.websiteUrl
      ? await scrapeWebsite(formData.websiteUrl)
      : null;

    const systemPrompt = buildSystemPrompt(formData, websiteContent);
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

    // Try both English and Spanish tag variants
    const content = {
      phase1: extractTag("PHASE1") || extractTag("FASE1"),
      phase2: extractTag("PHASE2") || extractTag("FASE2"),
      additional: extractTag("ADDITIONAL"),
      feeStructure: extractTag("FEE_STRUCTURE"),
      closingNote: extractTag("CLOSING_NOTE"),
    };

    const { needsBrand, needsLinkedIn } = deriveSections(formData);

    return NextResponse.json({
      template: needsBrand && needsLinkedIn ? "B" : needsLinkedIn ? "B" : "A",
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
