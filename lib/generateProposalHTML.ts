import type { GeneratedProposal } from "@/types/proposal";

function mdToHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])/gm, "")
    .replace(/\n/g, "<br>")
    .trim();
}

function formatSection(content: string): string {
  if (!content) return "<p><em>—</em></p>";
  const lines = content.split("\n");
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      continue;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      if (!inList) {
        result.push("<ul>");
        inList = true;
      }
      result.push(`<li>${trimmed.replace(/^[-•]\s+/, "")}</li>`);
    } else {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      const formatted = trimmed
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>");
      result.push(`<p>${formatted}</p>`);
    }
  }
  if (inList) result.push("</ul>");
  return result.join("\n");
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

export function generateProposalHTML(proposal: GeneratedProposal): string {
  const { formData, template, generatedAt } = proposal;
  const content = proposal.content as Record<string, string>;
  const date = new Date(generatedAt).toLocaleDateString(
    formData.language === "spanish" ? "es-ES" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  const servicesList = formData.services
    .map((s) => `<li>${SERVICE_LABELS[s] || s}</li>`)
    .join("");

  let sectionsHTML = "";

  if (template === "A") {
    sectionsHTML = `
      <div class="section">
        <div class="section-label">Main Gaps</div>
        <div class="section-content">${formatSection(content.gaps || "")}</div>
      </div>
      <div class="section">
        <div class="section-label">Phase 1 — Essential Brand Strategy Alignment</div>
        <div class="section-content">${formatSection(content.phase1 || "")}</div>
      </div>
      <div class="section">
        <div class="section-label">Phase 2 — LinkedIn Positioning Essentials</div>
        <div class="section-content">${formatSection(content.phase2 || "")}</div>
      </div>`;
  } else if (template === "B") {
    sectionsHTML = `
      <div class="section">
        <div class="section-label">Main Challenges &amp; Gaps</div>
        <div class="section-content">${formatSection(content.challenges || "")}</div>
      </div>
      <div class="section">
        <div class="section-label">Brand Strategy Alignment</div>
        <div class="section-content">${formatSection(content.brandStrategy || "")}</div>
      </div>
      <div class="section">
        <div class="section-label">Tailored Marketing Strategy &amp; Plan</div>
        <div class="section-content">${formatSection(content.marketingPlan || "")}</div>
      </div>
      <div class="section">
        <div class="section-label">LinkedIn Implementation &amp; Optimization</div>
        <div class="section-content">${formatSection(content.linkedinPlan || "")}</div>
      </div>`;
  } else {
    sectionsHTML = `
      <div class="section">
        <div class="section-label">Desafíos y Puntos de Dolor</div>
        <div class="section-content">${formatSection(content.challenges || "")}</div>
      </div>
      <div class="anc-grid">
        <div class="anc-card attract">
          <div class="anc-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          </div>
          <div class="anc-label">ATRAER</div>
          <div class="anc-content">${formatSection(content.attract || "")}</div>
        </div>
        <div class="anc-card nurture">
          <div class="anc-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="anc-label">NUTRIR</div>
          <div class="anc-content">${formatSection(content.nurture || "")}</div>
        </div>
        <div class="anc-card convert">
          <div class="anc-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="anc-label">CONVERTIR</div>
          <div class="anc-content">${formatSection(content.convert || "")}</div>
        </div>
      </div>`;
  }

  const feeLabel =
    template === "C" ? "Estructura de Honorarios" : "Fee Structure";
  const aboutLabel =
    template === "C" ? "Sobre Zinnia Group" : "About Zinnia Group";
  const servicesLabel =
    template === "C" ? "Servicios Incluidos" : "Services Included";
  const confidentialLabel =
    template === "C"
      ? "ZINNIA GROUP | Estrictamente Confidencial"
      : "ZINNIA GROUP | Strictly Confidential";
  const preparedLabel =
    template === "C" ? "Preparado para:" : "Prepared for:";
  const dateLabel = template === "C" ? "Fecha:" : "Date:";
  const printLabel = template === "C" ? "Imprimir / Guardar PDF" : "Print / Save as PDF";

  return `<!DOCTYPE html>
<html lang="${formData.language === "spanish" ? "es" : "en"}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Zinnia Group — Proposal for ${formData.prospectName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Space Grotesk', sans-serif;
    background: #E8EAF0;
    color: #1B2035;
    font-size: 15px;
    line-height: 1.7;
  }

  .print-bar {
    background: #1B2035;
    padding: 12px 40px;
    display: flex;
    justify-content: flex-end;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .print-btn {
    background: #DFF266;
    color: #1B2035;
    border: none;
    padding: 8px 20px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.02em;
    transition: opacity 0.2s;
  }

  .print-btn:hover { opacity: 0.85; }

  .document {
    max-width: 860px;
    margin: 32px auto;
    background: #FFFFFF;
    box-shadow: 0 4px 40px rgba(27,32,53,0.12);
  }

  /* Header */
  .header {
    background: #1B2035;
    padding: 48px 56px 36px;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 40px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-mark {
    width: 40px;
    height: 40px;
    background: #DFF266;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .logo-text {
    color: #FFFFFF;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .confidential {
    color: rgba(255,255,255,0.4);
    font-size: 11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    text-align: right;
    padding-top: 4px;
  }

  .header-prospect {
    color: #FFFFFF;
  }

  .header-label {
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .prospect-name {
    font-size: 32px;
    font-weight: 700;
    color: #DFF266;
    letter-spacing: -0.01em;
    margin-bottom: 16px;
  }

  .header-meta {
    display: flex;
    gap: 32px;
    font-size: 13px;
    color: rgba(255,255,255,0.6);
  }

  .header-meta span { display: flex; align-items: center; gap: 6px; }

  /* Services strip */
  .services-strip {
    background: #2A3150;
    padding: 20px 56px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .services-strip-label {
    font-size: 11px;
    color: rgba(255,255,255,0.4);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-right: 8px;
  }

  .service-tag {
    background: rgba(223,242,102,0.12);
    color: #DFF266;
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 2px;
    letter-spacing: 0.04em;
    font-weight: 500;
  }

  /* Body */
  .body {
    padding: 56px;
  }

  .section {
    margin-bottom: 48px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #1B2035;
    opacity: 0.4;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #E8EAF0;
  }

  .section-content p {
    margin-bottom: 12px;
    color: #1B2035;
    line-height: 1.75;
  }

  .section-content p:last-child { margin-bottom: 0; }

  .section-content ul {
    list-style: none;
    margin: 8px 0;
  }

  .section-content li {
    padding: 6px 0 6px 20px;
    position: relative;
    color: #1B2035;
    line-height: 1.6;
  }

  .section-content li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    width: 6px;
    height: 6px;
    background: #DFF266;
    border-radius: 50%;
  }

  .section-content strong { font-weight: 600; }

  /* ANC Grid (Template C) */
  .anc-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    margin-bottom: 48px;
  }

  .anc-card {
    padding: 28px 24px;
    background: #F7F8FC;
    border-top: 3px solid transparent;
  }

  .anc-card.attract { border-top-color: #DFF266; }
  .anc-card.nurture { border-top-color: #1B2035; }
  .anc-card.convert { border-top-color: #2A3150; }

  .anc-icon {
    margin-bottom: 12px;
    color: #1B2035;
    opacity: 0.5;
  }

  .anc-label {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #1B2035;
    margin-bottom: 16px;
  }

  .anc-content p {
    font-size: 13px;
    line-height: 1.65;
    color: #1B2035;
    margin-bottom: 8px;
  }

  .anc-content ul { list-style: none; }

  .anc-content li {
    font-size: 13px;
    padding: 4px 0 4px 16px;
    position: relative;
    color: #1B2035;
    line-height: 1.5;
  }

  .anc-content li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 10px;
    width: 5px;
    height: 5px;
    background: #DFF266;
    border-radius: 50%;
  }

  /* Fee structure highlight */
  .fee-section .section-content {
    background: #F7F8FC;
    padding: 28px 32px;
    border-left: 3px solid #DFF266;
  }

  /* Footer */
  .footer {
    background: #1B2035;
    padding: 28px 56px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-logo {
    color: rgba(255,255,255,0.4);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .footer-contact {
    color: rgba(255,255,255,0.6);
    font-size: 13px;
  }

  .footer-contact a {
    color: #DFF266;
    text-decoration: none;
  }

  @media print {
    body { background: white; }
    .print-bar { display: none; }
    .document {
      box-shadow: none;
      margin: 0;
      max-width: 100%;
    }
    .anc-grid { break-inside: avoid; }
    .section { break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="print-bar">
  <button class="print-btn" onclick="window.print()">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
    ${printLabel}
  </button>
</div>

<div class="document">
  <div class="header">
    <div class="header-top">
      <div class="logo">
        <div class="logo-mark">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B2035" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <div class="logo-text">Zinnia Group</div>
      </div>
      <div class="confidential">${confidentialLabel}</div>
    </div>
    <div class="header-prospect">
      <div class="header-label">${preparedLabel}</div>
      <div class="prospect-name">${formData.prospectName}</div>
      <div class="header-meta">
        <span>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${dateLabel} ${date}
        </span>
        ${formData.websiteUrl ? `<span><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>${formData.websiteUrl}</span>` : ""}
      </div>
    </div>
  </div>

  <div class="services-strip">
    <span class="services-strip-label">${servicesLabel}:</span>
    ${formData.services.map((s) => `<span class="service-tag">${SERVICE_LABELS[s] || s}</span>`).join("")}
  </div>

  <div class="body">
    ${sectionsHTML}

    <div class="section fee-section">
      <div class="section-label">${feeLabel}</div>
      <div class="section-content">${formatSection(content.feeStructure)}</div>
    </div>

    <div class="section">
      <div class="section-label">${aboutLabel}</div>
      <div class="section-content">${formatSection(content.aboutZinnia)}</div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-logo">Zinnia Group © ${new Date().getFullYear()}</div>
    <div class="footer-contact">
      <a href="mailto:leonardo@zinniagroup.io">leonardo@zinniagroup.io</a>
    </div>
  </div>
</div>

</body>
</html>`;
}
