import type { GeneratedProposal } from "@/types/proposal";

// A4 "investment memo" layout for the proposal. buildProposalModel runs in the
// browser (DOMParser) and turns the edited section HTML into a clean, typed
// model; buildPrintHTML (HTML download + print/PDF) and the Word export
// (/api/export-docx) both render from that same model.

export type SectionKey = "phase1" | "phase2" | "additional" | "feeStructure";

export interface EditedSections {
  phase1: string;
  phase2: string;
  additional: string;
  feeStructure: string;
  closingNote: string;
  // Section titles edited in the generator (override the AI heading)
  titles?: Partial<Record<SectionKey, string>>;
}

export interface Run { text: string; bold?: boolean }
export type BlockType = "p" | "sub" | "dur" | "price" | "li";
export interface Block { type: BlockType; runs: Run[] }
export interface ModelSection {
  key: SectionKey;
  num: string;
  gutter: string;
  title: string;
  kind: "phase" | "fee";
  blocks: Block[];
}
export interface ProposalModel {
  lang: "es" | "en";
  labels: Labels;
  name: string;
  site: string;
  date: string;
  preparedBy: string;
  contact: string;
  services: string[];
  investment: { amount: string; detail: string } | null;
  sections: ModelSection[];
  closing: Run[][];
}

type Labels = typeof LABELS_ES;
const LABELS_ES = {
  conf: "Estrictamente confidencial", titleA: "Propuesta de servicios", titleB: "para",
  for: "Preparado para", by: "Preparado por", date: "Fecha", services: "Servicios", invest: "Inversión",
  p1: "Fase 1", p2: "Fase 2", add: "Adicionales", fee: "Inversión",
  p1t: "Alineación estratégica de marca", p2t: "Posicionamiento en LinkedIn",
  addt: "Servicios adicionales", feet: "Estructura de inversión",
};
const LABELS_EN: Labels = {
  conf: "Strictly confidential", titleA: "Services proposal", titleB: "for",
  for: "Prepared for", by: "Prepared by", date: "Date", services: "Services", invest: "Investment",
  p1: "Phase 1", p2: "Phase 2", add: "Additional", fee: "Investment",
  p1t: "Brand strategy alignment", p2t: "LinkedIn positioning",
  addt: "Additional services", feet: "Fee structure",
};

export const AUTHOR = "Leonardo Hsu";
export const CONTACT = "leonardo@zinniagroup.io";

// House style: no middle dots or em/en dashes in client documents
export function cleanText(s: string): string {
  return s
    .replace(/\s*[\u2013\u2014]\s*/g, " - ")
    .replace(/\s*\u00B7\s*/g, " | ")
    .replace(/[ \t]{2,}/g, " ");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function sentenceCase(text: string, keep: string[]): string {
  const upper = (text.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length;
  const lower = (text.match(/[a-záéíóúñ]/g) || []).length;
  if (upper < 4 || lower > upper * 0.25) return text;
  let out = text.toLowerCase();
  out = out.charAt(0).toUpperCase() + out.slice(1);
  for (const word of keep) {
    if (!word) continue;
    const re = new RegExp(`(^|[^\\p{L}])(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^\\p{L}])`, "giu");
    out = out.replace(re, (_m, pre) => pre + word);
  }
  return out;
}

const isAllCaps = (t: string) => /[A-ZÁÉÍÓÚÑ]/.test(t) && !/[a-záéíóúñ]/.test(t);
const DELIVERY_RE = /^(tiempo estimado de entrega|estimated time of delivery|estimated delivery)/i;
const PHASE_PREFIX_RE = /^(fase|phase)\s*\d+\s*[:\-\u2013\u2014]\s*/i;
const AMOUNT_RE = /\$\s?[\d.,]+/;
const KEEP_BASE = ["LinkedIn", "Zinnia", "Zinnia Media", "Full Stack", "Essentials", "IA", "AI", "SEO", "M&A", "CEO", "USD", "Q&A", "HNW", "UHNW"];

// Element → runs, keeping bold from <strong>/<b>/.zn-label
function toRuns(el: Element): Run[] {
  const runs: Run[] = [];
  const walk = (node: Node, bold: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) runs.push({ text, bold });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const e = node as Element;
    if (e.tagName === "BR") { runs.push({ text: " ", bold }); return; }
    const b = bold || ["STRONG", "B"].includes(e.tagName) || e.classList.contains("zn-label");
    e.childNodes.forEach((c) => walk(c, b));
  };
  el.childNodes.forEach((c) => walk(c, false));
  // merge neighbours, clean text, trim ends
  const merged: Run[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && !!last.bold === !!r.bold) last.text += r.text;
    else merged.push({ ...r });
  }
  merged.forEach((r) => (r.text = cleanText(r.text.replace(/\s+/g, " "))));
  if (merged[0]) merged[0].text = merged[0].text.trimStart();
  if (merged.length) merged[merged.length - 1].text = merged[merged.length - 1].text.trimEnd();
  return merged.filter((r) => r.text !== "");
}

const runsText = (runs: Run[]) => runs.map((r) => r.text).join("");

function extractBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, "text/html");
  const root = doc.getElementById("r")!;
  const blocks: Block[] = [];
  const visit = (el: Element) => {
    const tag = el.tagName;
    if (tag === "UL" || tag === "OL") {
      el.querySelectorAll(":scope > li").forEach((li) => {
        const runs = toRuns(li);
        if (runs.length) blocks.push({ type: "li", runs });
      });
    } else if (tag === "DIV" && el.querySelector("p, ul, ol, div")) {
      Array.from(el.children).forEach(visit);
    } else {
      const runs = toRuns(el);
      const cls = (["dur", "sub", "price"] as const).find((c) => el.classList.contains(c));
      if (runs.length) blocks.push({ type: cls ?? "p", runs });
    }
  };
  Array.from(root.children).forEach(visit);
  // Loose text directly under the root (inline editor edits)
  if (!blocks.length) {
    const runs = toRuns(root);
    if (runs.length) blocks.push({ type: "p", runs });
  }
  return blocks;
}

function tidySection(html: string, fallbackTitle: string, dropTitles: string[], keep: string[], fee: boolean) {
  const blocks = extractBlocks(html);
  let title = fallbackTitle;

  // First paragraph is usually the AI's own heading ("FASE 1: …", "SERVICIOS ADICIONALES")
  const first = blocks[0];
  if (first && first.type === "p") {
    const t = runsText(first.runs);
    const norm = t.replace(PHASE_PREFIX_RE, "").replace(/[:.]$/, "").trim();
    const isDup = dropTitles.some((d) => norm.toLowerCase() === d.toLowerCase());
    if (PHASE_PREFIX_RE.test(t) || isDup) {
      if (norm && !isDup) title = sentenceCase(norm, keep);
      blocks.shift();
    }
  }

  for (const b of blocks) {
    if (b.type !== "p") continue;
    const t = runsText(b.runs);
    if (DELIVERY_RE.test(t)) {
      b.type = "dur";
    } else if (fee && AMOUNT_RE.test(t)) {
      b.type = "price";
      b.runs.forEach((r) => { if (r.bold) r.text = sentenceCase(r.text, [...keep, "Fase", "Phase"]); });
    } else if (isAllCaps(t) && t.length > 3 && t.length < 120 && !AMOUNT_RE.test(t)) {
      b.type = "sub";
      b.runs = [{ text: sentenceCase(t.replace(/:$/, ""), keep) }];
    }
  }
  return { title, blocks };
}

function investmentSummary(blocks: Block[], keep: string[]) {
  const lines = blocks.map((b) => runsText(b.runs));
  const amountLine = lines.find((l) => AMOUNT_RE.test(l));
  if (!amountLine) return null;
  const idx = amountLine.lastIndexOf(":");
  const plan = idx > 0 ? sentenceCase(amountLine.slice(0, idx).trim(), [...keep, "Fase", "Phase"]) : "";
  const amount = (idx > 0 ? amountLine.slice(idx + 1) : amountLine).trim().replace(/\.$/, "");
  const term = lines.find((l) => l !== amountLine && /\b(mes(es)?|months?)\b/i.test(l) && !AMOUNT_RE.test(l));
  return { amount, detail: [plan, term?.replace(/\.$/, "")].filter(Boolean).join(" | ") };
}

export function buildProposalModel(
  p: GeneratedProposal,
  edited: EditedSections,
  serviceLabels: Record<string, string>,
): ProposalModel {
  const es = p.formData.language === "spanish";
  const L = es ? LABELS_ES : LABELS_EN;
  const name = p.formData.prospectName.trim();
  const keep = [name, ...name.split(/\s+/), ...KEEP_BASE];
  const drop = ["servicios adicionales", "additional essentials", "additional services", "estructura de honorarios", "fee structure & breakdown", "fee structure"];
  const defs = [
    { key: "phase1" as const, html: edited.phase1, gutter: L.p1, title: L.p1t, kind: "phase" as const, drop },
    { key: "phase2" as const, html: edited.phase2, gutter: L.p2, title: L.p2t, kind: "phase" as const, drop },
    { key: "additional" as const, html: edited.additional, gutter: L.add, title: L.addt, kind: "phase" as const, drop },
    { key: "feeStructure" as const, html: edited.feeStructure, gutter: L.fee, title: L.feet, kind: "fee" as const, drop: [...drop, "estructura de inversión", "investment structure"] },
  ];
  const sections: ModelSection[] = [];
  let feeBlocks: Block[] = [];
  for (const d of defs) {
    const tidy = tidySection(d.html, d.title, d.drop, keep, d.kind === "fee");
    const blocks = tidy.blocks;
    if (!blocks.length) continue;
    const edTitle = edited.titles?.[d.key]?.trim();
    const title = edTitle ? cleanText(edTitle) : tidy.title;
    if (d.kind === "fee") feeBlocks = blocks;
    sections.push({ key: d.key, num: String(sections.length + 1).padStart(2, "0"), gutter: d.gutter, title, kind: d.kind, blocks });
  }
  return {
    lang: es ? "es" : "en",
    labels: L,
    name,
    site: p.formData.websiteUrl.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""),
    date: new Date(p.generatedAt).toLocaleDateString(es ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric" }),
    preparedBy: `${AUTHOR} | Zinnia Group`,
    contact: CONTACT,
    services: [
      ...p.formData.services.map((s) => serviceLabels[s] || s),
      ...(p.formData.customService?.trim() ? [p.formData.customService.trim()] : []),
    ],
    investment: investmentSummary(feeBlocks, keep),
    sections,
    closing: extractBlocks(edited.closingNote).map((b) => b.runs),
  };
}

// ─── HTML (download + print/PDF) ────────────────────────────────────────────

const LOGO_DARK = `<svg width="112" height="22" viewBox="0 0 160 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Zinnia"><path d="M37.3379 28.6284V26.0841L56.7583 4.85914L58.4097 6.19825H37.47V3.52002H59.6648V6.03086L40.2443 27.2893L38.7581 25.9502H59.7639V28.6284H37.3379Z" fill="#1B2035"/><path d="M62.3377 3.52002H65.4423V28.6284H62.3377V3.52002Z" fill="#1B2035"/><path d="M92.6372 27.055L91.1179 27.1554V3.52002H94.1235V28.6284H90.1271L71.2682 4.99305L72.7874 4.89261V28.6284H69.7819V3.52002H73.8113L92.6372 27.055Z" fill="#1B2035"/><path d="M121.304 27.055L119.785 27.1554V3.52002H122.791V28.6284H118.794L99.9354 4.99305L101.455 4.89261V28.6284H98.4491V3.52002H102.479L121.304 27.055Z" fill="#1B2035"/><path d="M127.116 3.52002H130.221V28.6284H127.116V3.52002Z" fill="#1B2035"/><path d="M137.104 22.4016V19.7233H154.542V22.4016H137.104ZM147.772 3.52002L159.959 28.6284H156.59L145.129 4.59131H146.781L135.287 28.6284H131.918L144.106 3.52002H147.772Z" fill="#1B2035"/><path d="M10.9386 11.7915L19.3035 3.27539H27.6684V11.7915L19.3035 20.3077V11.7915H10.9386Z" fill="#1B2035"/><path d="M19.3035 20.3077H27.6684V28.8238H19.3035V20.3077Z" fill="#1B2035"/><path d="M10.9386 11.7915L2.57373 20.3077V28.8238H10.9386L19.3035 20.3077H10.9386V11.7915Z" fill="#1B2035"/><path d="M10.9386 11.7915H2.57373V3.27539H10.9386V11.7915Z" fill="#1B2035"/></svg>`;

const runsHTML = (runs: Run[]) => runs.map((r) => (r.bold ? `<strong>${esc(r.text)}</strong>` : esc(r.text))).join("");

export function blocksHTML(blocks: Block[]): string {
  const out: string[] = [];
  let inList = false;
  for (const b of blocks) {
    if (b.type === "li") {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${runsHTML(b.runs)}</li>`);
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p${b.type === "p" ? "" : ` class="${b.type}"`}>${runsHTML(b.runs)}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

export const closingHTML = (m: ProposalModel) => m.closing.map((r) => `<p>${runsHTML(r)}</p>`).join("");

export const printTitle = (m: ProposalModel) => `Zinnia - ${m.name}`;

export const MEMO_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Geist:wght@400;500;600&display=swap";

// Shared by the in-app editor and the exported HTML/PDF, so the generator
// shows exactly what prints. Everything is scoped under .memo.
export const MEMO_CSS = `
.memo { --navy:#1B2035; --lime:#DFF266; --blue:#D1E2F4; --rule:#E3E6EE; --mut:#565C72;
  font-family:'Geist',system-ui,sans-serif; color:var(--navy); font-size:13px; line-height:1.6; -webkit-font-smoothing:antialiased; font-variant-numeric:tabular-nums;
  width:210mm; min-height:297mm; margin:0 auto; background:#fff; padding:16mm 18mm 18mm; box-shadow:0 1px 2px rgba(27,32,53,.08), 0 8px 28px rgba(27,32,53,.10); display:flex; flex-direction:column; }
.memo * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.memo ::selection { background:var(--lime); color:var(--navy); }
.memo h1, .memo h2, .memo .num, .memo .sub, .memo .amt, .memo .price { font-family:'Space Grotesk',system-ui,sans-serif; }
.memo .top { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
.memo .conf { font-size:9.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--mut); }
.memo h1 { font-size:31px; line-height:1.12; font-weight:600; letter-spacing:-.015em; margin-bottom:20px; text-wrap:balance; }
.memo h1 mark { background:linear-gradient(transparent 60%, var(--lime) 60%); color:inherit; padding:0 2px; -webkit-box-decoration-break:clone; box-decoration-break:clone; }
.memo table.meta { width:100%; border-collapse:collapse; font-size:12.5px; margin-bottom:30px; }
.memo .meta td { padding:7px 0; border-top:1px solid var(--rule); vertical-align:top; }
.memo .meta tr:last-child td { border-bottom:1px solid var(--rule); }
.memo .meta td.k { width:128px; color:var(--mut); }
.memo .chip { display:inline-block; border:1px solid #C6CBD9; border-radius:3px; padding:0 7px; margin:1px 4px 3px 0; font-size:11.5px; }
.memo .meta tr.inv td { background:var(--navy); color:#fff; border-color:var(--navy); padding:10px 0; }
.memo .meta tr.inv td.k { color:#B6BCCE; padding-left:12px; }
.memo .inv .amt { display:block; font-size:19px; font-weight:600; line-height:1.25; color:var(--lime); white-space:nowrap; }
.memo .inv .plan { font-size:12px; color:#E4E7EF; }
.memo .sec { position:relative; padding-left:128px; margin-bottom:26px; }
.memo .gut { position:absolute; left:0; top:0; }
.memo .num { font-size:38px; font-weight:600; line-height:.95; letter-spacing:-.02em; }
.memo .gl { font-size:9.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--mut); margin-top:8px; }
.memo h2 { font-size:17.5px; font-weight:600; line-height:1.3; letter-spacing:-.01em; margin:2px 0 10px; text-wrap:balance; }
.memo .body p { margin-bottom:7px; }
.memo .body p.sub { font-size:13.5px; font-weight:600; margin:14px 0 5px; }
.memo .body p.dur { display:inline-block; background:var(--blue); border-radius:3px; padding:1px 8px; font-size:11.5px; margin:4px 0 12px; }
.memo .body ul { list-style:none; margin:4px 0 10px; }
.memo .body li { position:relative; padding-left:16px; margin:3px 0; }
.memo .body li::before { content:""; position:absolute; left:1px; top:.62em; width:5px; height:5px; background:var(--navy); }
.memo .body strong, .memo .body b { font-weight:600; }
.memo .fee .body { background:#F3F5F9; border-radius:6px; padding:16px 20px 10px; }
.memo .fee .body p.price { font-size:15px; font-weight:600; margin:2px 0 6px; }
.memo .closing { margin-top:8px; padding:18px 0 0 128px; border-top:1px solid var(--navy); }
.memo .closing p { font-size:13.5px; line-height:1.65; margin-bottom:8px; }
.memo .sign { margin-top:12px; font-size:12px; color:var(--mut); line-height:1.5; }
.memo .sign b { color:var(--navy); font-weight:600; }
.memo .foot { margin-top:auto; padding-top:28px; }
.memo .foot div { display:flex; justify-content:space-between; border-top:1px solid var(--rule); padding-top:8px; font-size:8pt; color:var(--mut); }
.memo .foot span:first-child { letter-spacing:.06em; text-transform:uppercase; }
`;

export function memoHeaderHTML(m: ProposalModel): string {
  const L = m.labels;
  return `<header class="top">${LOGO_DARK}<div class="conf">${L.conf}</div></header>
  <h1>${L.titleA}<br>${L.titleB} <mark>${esc(m.name)}</mark></h1>
  <table class="meta">
    <tr><td class="k">${L.for}</td><td>${esc(m.name)}${m.site ? ` | ${esc(m.site)}` : ""}</td></tr>
    <tr><td class="k">${L.by}</td><td>${esc(m.preparedBy)}</td></tr>
    <tr><td class="k">${L.date}</td><td>${esc(m.date)}</td></tr>
    ${m.services.length ? `<tr><td class="k">${L.services}</td><td>${m.services.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</td></tr>` : ""}
    ${m.investment ? `<tr class="inv"><td class="k">${L.invest}</td><td><span class="amt">${esc(m.investment.amount)}</span><span class="plan">${esc(m.investment.detail)}</span></td></tr>` : ""}
  </table>`;
}

export const signHTML = (m: ProposalModel) => `<div class="sign"><b>${esc(m.preparedBy)}</b><br>${m.contact}</div>`;

// On screen only; on paper the same line comes from the @page margin boxes
export const screenFooterHTML = (m: ProposalModel) =>
  `<div class="foot"><div><span>Zinnia Group | ${m.labels.conf}</span><span>${m.contact}</span></div></div>`;

export function buildPrintHTML(m: ProposalModel): string {
  const L = m.labels;
  const sectionHTML = m.sections
    .map((s) => `<section class="sec ${s.kind}">
  <div class="gut"><div class="num">${s.num}</div><div class="gl">${esc(s.gutter)}</div></div>
  <h2>${esc(s.title)}</h2><div class="body">${blocksHTML(s.blocks)}</div>
</section>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="${m.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(printTitle(m))}</title>
<link href="${MEMO_FONTS_HREF}" rel="stylesheet">
<style>
html { background:#E6E8EE; }
body { margin:0; padding:24px 0; }
${MEMO_CSS}
@page {
  size:A4;
  margin:16mm 18mm 20mm;
  @top-left { content:""; }
  @top-center { content:""; }
  @top-right { content:""; }
  @bottom-left { content:"Zinnia Group | ${L.conf}"; font-family:'Geist',sans-serif; font-size:8pt; letter-spacing:.06em; color:#565C72; text-transform:uppercase; vertical-align:top; padding-top:4mm; border-top:0.75pt solid #E3E6EE; }
  @bottom-right { content:"${m.contact} | " counter(page) " / " counter(pages); font-family:'Geist',sans-serif; font-size:8pt; color:#565C72; vertical-align:top; padding-top:4mm; border-top:0.75pt solid #E3E6EE; }
}
@media print {
  html { background:#fff; }
  body { padding:0; }
  .memo { width:auto; min-height:0; margin:0; padding:0; box-shadow:none; display:block; }
  .memo .foot { display:none; }
  .memo .top, .memo table.meta, .memo .meta tr, .memo h2, .memo .gut { break-inside:avoid; }
  .memo h2, .memo .sub { break-after:avoid; }
  .memo .body li, .memo .body p { break-inside:avoid; orphans:3; widows:3; }
  .memo .fee .body { break-inside:avoid; }
  .memo .closing p { break-inside:avoid; }
}
</style>
</head>
<body>
<main class="memo">
  ${memoHeaderHTML(m)}
${sectionHTML}
  ${m.closing.length ? `<section class="closing">${closingHTML(m)}${signHTML(m)}</section>` : ""}
  ${screenFooterHTML(m)}
</main>
</body>
</html>`;
}
