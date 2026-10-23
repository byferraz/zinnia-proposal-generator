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
  // Everything else Leo can edit in the generator (overrides the defaults)
  titles?: Partial<Record<SectionKey, string>>;
  gutters?: Partial<Record<SectionKey, string>>;
  header?: { conf: string; title: string; rows: { label: string; value: string }[] };
  sign?: string;
  // Sections Leo added in the generator, shown after the AI sections
  extra?: { id: string; title: string; gutter: string; body: string }[];
  // Section numbers as shown in the generator (Leo can overwrite them)
  nums?: Record<string, string>;
  // Content already laid out by the generator: export it exactly as shown
  fromEditor?: boolean;
}

export interface Run { text: string; bold?: boolean; mark?: boolean }
export interface MetaRow { label: string; runs: Run[]; chips: string[] | null }
export type BlockType = "p" | "sub" | "dur" | "price" | "li";
export interface Block { type: BlockType; runs: Run[] }
export interface ModelSection {
  key: string;
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
  contact: string;
  conf: string;
  title: Run[][];
  meta: MetaRow[];
  sections: ModelSection[];
  closing: Run[][];
  sign: Run[][];
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
  const walk = (node: Node, bold: boolean, mark: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) runs.push({ text, bold, mark });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const e = node as Element;
    if (e.tagName === "BR") { runs.push({ text: " ", bold, mark }); return; }
    if (e.classList.contains("row-del") || e.classList.contains("sec-del")) return;
    const b = bold || ["STRONG", "B"].includes(e.tagName) || e.classList.contains("zn-label");
    const mk = mark || e.tagName === "MARK";
    e.childNodes.forEach((c) => walk(c, b, mk));
  };
  el.childNodes.forEach((c) => walk(c, false, false));
  // merge neighbours, clean text, trim ends
  const merged: Run[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && !!last.bold === !!r.bold && !!last.mark === !!r.mark) last.text += r.text;
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

function tidySection(html: string, fallbackTitle: string, dropTitles: string[], keep: string[], fee: boolean, asIs = false) {
  const blocks = extractBlocks(html);
  let title = fallbackTitle;
  if (asIs) return { title, blocks };

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

// Split editable HTML into lines (Chrome wraps new lines in <div> or uses <br>)
function htmlLines(html: string): Run[][] {
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, "text/html");
  const root = doc.getElementById("r")!;
  const lines: Run[][] = [];
  let current = doc.createElement("span");
  const flush = () => { const r = toRuns(current); if (r.length) lines.push(r); current = doc.createElement("span"); };
  root.childNodes.forEach((n) => {
    const el = n as Element;
    if (n.nodeType === Node.ELEMENT_NODE && el.tagName === "BR") { flush(); return; }
    if (n.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(el.tagName)) {
      flush();
      htmlLines(el.innerHTML).forEach((l) => lines.push(l));
      return;
    }
    current.appendChild(n.cloneNode(true));
  });
  flush();
  return lines;
}

function metaFromHTML(label: string, value: string): MetaRow {
  const doc = new DOMParser().parseFromString(`<div id="r">${value}</div>`, "text/html");
  const root = doc.getElementById("r")!;
  const chipEls = root.querySelectorAll(".chip");
  const chips = chipEls.length
    ? Array.from(chipEls).map((c) => cleanText((c.textContent ?? "").replace(/\s+/g, " ").trim())).filter(Boolean)
    : null;
  return { label: cleanText(label.replace(/\s+/g, " ").trim()), runs: chips ? [] : toRuns(root), chips };
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
  for (const d of defs) {
    const tidy = tidySection(d.html, d.title, d.drop, keep, d.kind === "fee", edited.fromEditor);
    const blocks = tidy.blocks;
    if (!blocks.length) continue;
    const edTitle = edited.titles?.[d.key]?.trim();
    const title = edTitle ? cleanText(edTitle) : tidy.title;
    const gutter = edited.gutters?.[d.key]?.trim() ? cleanText(edited.gutters[d.key]!.trim()) : d.gutter;
    sections.push({ key: d.key, num: String(sections.length + 1).padStart(2, "0"), gutter, title, kind: d.kind, blocks });
  }
  for (const x of edited.extra ?? []) {
    const blocks = extractBlocks(x.body);
    const title = cleanText(x.title.trim());
    if (!blocks.length && !title) continue;
    sections.push({ key: x.id, num: String(sections.length + 1).padStart(2, "0"), gutter: cleanText(x.gutter.trim()), title, kind: "phase", blocks });
  }
  for (const sec of sections) {
    const n = edited.nums?.[sec.key]?.trim();
    if (n !== undefined) sec.num = cleanText(n);
  }
  const site = p.formData.websiteUrl.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const date = new Date(p.generatedAt).toLocaleDateString(es ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  const services = [
    ...p.formData.services.map((s) => serviceLabels[s] || s),
    ...(p.formData.customService?.trim() ? [p.formData.customService.trim()] : []),
  ];
  const preparedBy = `${AUTHOR} | Zinnia Group`;
  const h = edited.header;
  const meta: MetaRow[] = h
    ? h.rows.map((r) => metaFromHTML(r.label, r.value)).filter((r) => r.label || r.runs.length || r.chips?.length)
    : [
        { label: L.for, runs: [{ text: `${name}${site ? ` | ${site}` : ""}` }], chips: null },
        { label: L.by, runs: [{ text: preparedBy }], chips: null },
        { label: L.date, runs: [{ text: date }], chips: null },
        ...(services.length ? [{ label: L.services, runs: [], chips: services }] : []),
      ];
  return {
    lang: es ? "es" : "en",
    labels: L,
    name,
    contact: CONTACT,
    conf: h ? cleanText(h.conf.trim()) : L.conf,
    title: h ? htmlLines(h.title) : [[{ text: L.titleA }], [{ text: `${L.titleB} ` }, { text: name, mark: true }]],
    meta,
    sections,
    closing: extractBlocks(edited.closingNote).map((b) => b.runs),
    sign: edited.sign !== undefined ? htmlLines(edited.sign) : [[{ text: preparedBy, bold: true }], [{ text: CONTACT }]],
  };
}

// ─── HTML (download + print/PDF) ────────────────────────────────────────────

const LOGO_DARK = `<svg width="112" height="22" viewBox="0 0 160 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Zinnia"><path d="M37.3379 28.6284V26.0841L56.7583 4.85914L58.4097 6.19825H37.47V3.52002H59.6648V6.03086L40.2443 27.2893L38.7581 25.9502H59.7639V28.6284H37.3379Z" fill="#1B2035"/><path d="M62.3377 3.52002H65.4423V28.6284H62.3377V3.52002Z" fill="#1B2035"/><path d="M92.6372 27.055L91.1179 27.1554V3.52002H94.1235V28.6284H90.1271L71.2682 4.99305L72.7874 4.89261V28.6284H69.7819V3.52002H73.8113L92.6372 27.055Z" fill="#1B2035"/><path d="M121.304 27.055L119.785 27.1554V3.52002H122.791V28.6284H118.794L99.9354 4.99305L101.455 4.89261V28.6284H98.4491V3.52002H102.479L121.304 27.055Z" fill="#1B2035"/><path d="M127.116 3.52002H130.221V28.6284H127.116V3.52002Z" fill="#1B2035"/><path d="M137.104 22.4016V19.7233H154.542V22.4016H137.104ZM147.772 3.52002L159.959 28.6284H156.59L145.129 4.59131H146.781L135.287 28.6284H131.918L144.106 3.52002H147.772Z" fill="#1B2035"/><path d="M10.9386 11.7915L19.3035 3.27539H27.6684V11.7915L19.3035 20.3077V11.7915H10.9386Z" fill="#1B2035"/><path d="M19.3035 20.3077H27.6684V28.8238H19.3035V20.3077Z" fill="#1B2035"/><path d="M10.9386 11.7915L2.57373 20.3077V28.8238H10.9386L19.3035 20.3077H10.9386V11.7915Z" fill="#1B2035"/><path d="M10.9386 11.7915H2.57373V3.27539H10.9386V11.7915Z" fill="#1B2035"/></svg>`;

const runsHTML = (runs: Run[]) =>
  runs
    .map((r) => {
      let h = esc(r.text);
      if (r.bold) h = `<strong>${h}</strong>`;
      if (r.mark) h = `<mark>${h}</mark>`;
      return h;
    })
    .join("");
const linesHTML = (lines: Run[][]) => lines.map(runsHTML).join("<br>");

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
.memo h1, .memo h2, .memo .num, .memo .sub, .memo .price { font-family:'Space Grotesk',system-ui,sans-serif; }
.memo .top { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
.memo .conf { font-size:9.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--mut); }
.memo h1 { font-size:31px; line-height:1.12; font-weight:600; letter-spacing:-.015em; margin-bottom:20px; text-wrap:balance; }
.memo .hero { background:var(--navy); color:#fff; border-radius:8px; padding:24px 26px 12px; margin-bottom:32px; }
.memo .hero h1 { color:#fff; margin-bottom:18px; }
.memo .hero h1 mark { background:none; color:var(--lime); padding:0; }
.memo table.meta { width:100%; border-collapse:collapse; font-size:12.5px; }
.memo .meta td { padding:7px 0; border-top:1px solid rgba(255,255,255,.13); vertical-align:top; }
.memo .meta td.k { width:102px; color:#A9AFC4; padding-right:10px; }
.memo .meta td.v { color:#fff; }
.memo .meta td.x { width:0; padding:0; position:relative; }
.memo .chip { display:inline-block; border:1px solid rgba(255,255,255,.3); border-radius:3px; padding:0 7px; margin:1px 4px 3px 0; font-size:11.5px; color:#fff; }
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
.memo .sign strong { color:var(--navy); font-weight:600; }
.memo .foot { margin-top:auto; padding-top:28px; }
.memo .foot div { display:flex; justify-content:space-between; border-top:1px solid var(--rule); padding-top:8px; font-size:8pt; color:var(--mut); }
.memo .foot span:first-child { letter-spacing:.06em; text-transform:uppercase; }
`;

// editable=true adds contenteditable + row delete buttons for the generator
export function memoHeaderHTML(m: ProposalModel, editable = false): string {
  const ce = editable ? ' contenteditable="true" spellcheck="false"' : "";
  const rows = m.meta
    .map((r) => {
      const value = r.chips ? r.chips.map((c) => `<span class="chip">${esc(c)}</span>`).join("") : runsHTML(r.runs);
      const del = editable ? `<td class="x"><button type="button" class="row-del" title="Eliminar fila" contenteditable="false">&times;</button></td>` : "";
      return `<tr><td class="k"${ce}>${esc(r.label)}</td><td class="v"${ce}>${value}</td>${del}</tr>`;
    })
    .join("");
  return `<header class="top">${LOGO_DARK}<div class="conf"${ce}>${esc(m.conf)}</div></header>
  <div class="hero">
    <h1${ce}>${linesHTML(m.title)}</h1>
    ${rows || editable ? `<table class="meta">${rows}</table>` : ""}
    ${editable ? `<button type="button" class="row-add" contenteditable="false">+ ${m.lang === "es" ? "Agregar fila" : "Add row"}</button>` : ""}
  </div>`;
}

// One empty editable header row (generator only)
export function editableRowHTML(): string {
  const ce = ' contenteditable="true" spellcheck="false"';
  return `<tr><td class="k"${ce}></td><td class="v"${ce}></td><td class="x"><button type="button" class="row-del" title="Eliminar fila" contenteditable="false">&times;</button></td></tr>`;
}

export const signHTML = (m: ProposalModel) => linesHTML(m.sign);

// On screen only; on paper the same line comes from the @page margin boxes
export const screenFooterHTML = (m: ProposalModel) =>
  `<div class="foot"><div><span>Zinnia Group | ${esc(m.conf)}</span><span>${m.contact}</span></div></div>`;

export function buildPrintHTML(m: ProposalModel): string {
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
  @bottom-left { content:"Zinnia Group | ${m.conf.replace(/["\\]/g, "")}"; font-family:'Geist',sans-serif; font-size:8pt; letter-spacing:.06em; color:#565C72; text-transform:uppercase; vertical-align:top; padding-top:4mm; border-top:0.75pt solid #E3E6EE; }
  @bottom-right { content:"${m.contact} | " counter(page) " / " counter(pages); font-family:'Geist',sans-serif; font-size:8pt; color:#565C72; vertical-align:top; padding-top:4mm; border-top:0.75pt solid #E3E6EE; }
}
@media print {
  html { background:#fff; }
  body { padding:0; }
  .memo { width:auto; min-height:0; margin:0; padding:0; box-shadow:none; display:block; }
  .memo .foot { display:none; }
  .memo .top, .memo .hero, .memo h2, .memo .gut { break-inside:avoid; }
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
  ${m.closing.length || m.sign.length ? `<section class="closing">${closingHTML(m)}${m.sign.length ? `<div class="sign">${signHTML(m)}</div>` : ""}</section>` : ""}
  ${screenFooterHTML(m)}
</main>
</body>
</html>`;
}
