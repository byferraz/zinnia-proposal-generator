"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Download, ArrowLeft, Loader2, Check, ChevronDown } from "lucide-react";
import type { GeneratedProposal } from "@/types/proposal";

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

function formatContent(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (inList) { result.push("</ul>"); inList = false; }
      continue;
    }
    if (t.startsWith("- ") || t.startsWith("• ")) {
      if (!inList) { result.push('<ul class="zn-list">'); inList = true; }
      result.push(`<li>${t.replace(/^[-•]\s+/, "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</li>`);
    } else {
      if (inList) { result.push("</ul>"); inList = false; }
      const formatted = t
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/^(PHASE \d+:|FASE \d+:|TAILORED|STRATEGIC|FULL STACK|FEE|ADDITIONAL|ZINNIA MEDIA|EXECUTIVE|OPTION \d+:)/i,
          (m) => `<span class="zn-label">${m}</span>`);
      result.push(`<p>${formatted}</p>`);
    }
  }
  if (inList) result.push("</ul>");
  return result.join("\n");
}

export default function ProposalPage() {
  const router = useRouter();
  const [proposal, setProposal] = useState<GeneratedProposal | null>(null);
  const [saved, setSaved] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "word" | null>(null);

  const phase1Ref = useRef<HTMLDivElement>(null);
  const phase2Ref = useRef<HTMLDivElement>(null);
  const additionalRef = useRef<HTMLDivElement>(null);
  const feeRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("zinnia_proposal");
    if (!stored) { router.replace("/"); return; }
    const data = JSON.parse(stored) as GeneratedProposal & { editedHTML?: Record<string, string> };
    setProposal(data);
  }, [router]);

  // Set initial HTML via refs — NOT via dangerouslySetInnerHTML — so React
  // never overwrites user edits on re-render (setSaved, etc.)
  useEffect(() => {
    if (!proposal) return;
    const src = (proposal as GeneratedProposal & { editedHTML?: Record<string, string> }).editedHTML;
    if (phase1Ref.current)
      phase1Ref.current.innerHTML = src?.phase1 ?? formatContent(proposal.content.phase1);
    if (phase2Ref.current)
      phase2Ref.current.innerHTML = src?.phase2 ?? formatContent(proposal.content.phase2);
    if (additionalRef.current)
      additionalRef.current.innerHTML = src?.additional ?? formatContent(proposal.content.additional);
    if (feeRef.current)
      feeRef.current.innerHTML = src?.feeStructure ?? formatContent(proposal.content.feeStructure);
    if (closingRef.current)
      closingRef.current.innerHTML = src?.closingNote ?? (proposal.content.closingNote ? `<p>${proposal.content.closingNote}</p>` : "");
  }, [proposal]);

  function getEditedHTML() {
    return {
      phase1: phase1Ref.current?.innerHTML || "",
      phase2: phase2Ref.current?.innerHTML || "",
      additional: additionalRef.current?.innerHTML || "",
      feeStructure: feeRef.current?.innerHTML || "",
      closingNote: closingRef.current?.innerHTML || "",
    };
  }

  function handleSave() {
    if (!proposal) return;
    const editedHTML = getEditedHTML();
    const updated = { ...proposal, editedHTML };
    sessionStorage.setItem("zinnia_proposal", JSON.stringify(updated));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function buildPrintHTML(): string {
    if (!proposal) return "";
    const p = proposal;
    const date = new Date(p.generatedAt).toLocaleDateString(
      p.formData.language === "spanish" ? "es-ES" : "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );
    const isSpanish = p.formData.language === "spanish";
    const phase1Label = isSpanish ? "FASE 1: ALINEACIÓN ESTRATÉGICA DE MARCA" : "PHASE 1: ESSENTIAL BRAND STRATEGY ALIGNMENT";
    const phase2Label = isSpanish ? "FASE 2: POSICIONAMIENTO EN LINKEDIN" : "PHASE 2: POSITIONING – LINKEDIN ESSENTIALS";
    const addLabel = isSpanish ? "SERVICIOS ADICIONALES" : "ADDITIONAL ESSENTIALS";
    const feeLabel = isSpanish ? "ESTRUCTURA DE HONORARIOS" : "FEE STRUCTURE & BREAKDOWN";
    const confidential = isSpanish ? "ZINNIA GROUP | Estrictamente Confidencial" : "ZINNIA GROUP | Strictly Confidential";

    const edited = getEditedHTML();

    const logoSvg = `<svg width="130" height="26" viewBox="0 0 160 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M37.3379 28.6284V26.0841L56.7583 4.85914L58.4097 6.19825H37.47V3.52002H59.6648V6.03086L40.2443 27.2893L38.7581 25.9502H59.7639V28.6284H37.3379Z" fill="#fff"/><path d="M62.3377 3.52002H65.4423V28.6284H62.3377V3.52002Z" fill="#fff"/><path d="M92.6372 27.055L91.1179 27.1554V3.52002H94.1235V28.6284H90.1271L71.2682 4.99305L72.7874 4.89261V28.6284H69.7819V3.52002H73.8113L92.6372 27.055Z" fill="#fff"/><path d="M121.304 27.055L119.785 27.1554V3.52002H122.791V28.6284H118.794L99.9354 4.99305L101.455 4.89261V28.6284H98.4491V3.52002H102.479L121.304 27.055Z" fill="#fff"/><path d="M127.116 3.52002H130.221V28.6284H127.116V3.52002Z" fill="#fff"/><path d="M137.104 22.4016V19.7233H154.542V22.4016H137.104ZM147.772 3.52002L159.959 28.6284H156.59L145.129 4.59131H146.781L135.287 28.6284H131.918L144.106 3.52002H147.772Z" fill="#fff"/><path d="M10.9386 11.7915L19.3035 3.27539H27.6684V11.7915L19.3035 20.3077V11.7915H10.9386Z" fill="#DFF266"/><path d="M19.3035 20.3077H27.6684V28.8238H19.3035V20.3077Z" fill="#DFF266"/><path d="M10.9386 11.7915L2.57373 20.3077V28.8238H10.9386L19.3035 20.3077H10.9386V11.7915Z" fill="#DFF266"/><path d="M10.9386 11.7915H2.57373V3.27539H10.9386V11.7915Z" fill="#DFF266"/></svg>`;

    const sectionBlock = (label: string, html: string, extraClass = "") => {
      if (!html || !html.replace(/<[^>]*>/g, "").trim()) return "";
      return `<div class="section ${extraClass}"><div class="section-title">${label}</div><div class="section-body">${html}</div></div>`;
    };

    const allServices = [
      ...p.formData.services.map(s => SERVICE_LABELS[s] || s),
      ...(p.formData.customService?.trim() ? [p.formData.customService.trim()] : []),
    ];
    const services = allServices.map(s => `<span class="tag">${s}</span>`).join("");

    return `<!DOCTYPE html>
<html lang="${isSpanish ? "es" : "en"}">
<head>
<meta charset="UTF-8">
<title>Zinnia — ${p.formData.prospectName}</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { font-family:'Space Grotesk',sans-serif; background:#fff; color:#1B2035; font-size:13px; line-height:1.65; }
.doc { max-width:780px; margin:0 auto; background:#fff; }
.header { background:#1B2035; padding:36px 48px 28px; }
.header-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; }
.conf { color:rgba(255,255,255,.35); font-size:10px; letter-spacing:.14em; text-transform:uppercase; }
.prospect-label { font-size:10px; color:rgba(255,255,255,.45); letter-spacing:.12em; text-transform:uppercase; margin-bottom:4px; }
.prospect-name { font-size:26px; font-weight:700; color:#DFF266; letter-spacing:-.01em; margin-bottom:10px; }
.meta { font-size:11px; color:rgba(255,255,255,.5); }
.tags { background:#2A3150; padding:12px 48px; display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.tags-label { font-size:10px; color:rgba(255,255,255,.35); letter-spacing:.12em; text-transform:uppercase; margin-right:6px; }
.tag { background:rgba(223,242,102,.15); color:#DFF266; font-size:10px; padding:3px 8px; border-radius:2px; font-weight:500; }
.body { padding:36px 48px; }
.section { margin-bottom:32px; }
.section-title { font-size:10px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:rgba(27,32,53,.4); padding-bottom:10px; border-bottom:1px solid #E8EAF0; margin-bottom:14px; }
.section-body p { margin-bottom:7px; }
.section-body ul, .section-body .zn-list { list-style:none; margin:6px 0; padding:0; }
.section-body li { padding:3px 0 3px 16px; position:relative; }
.section-body li::before { content:''; position:absolute; left:0; top:10px; width:5px; height:5px; background:#DFF266; border-radius:50%; }
.section-body strong, .section-body .zn-label { font-weight:700; }
.fee-section .section-body { background:#F7F8FC; padding:18px 22px; border-left:3px solid #DFF266; }
.closing { background:#1B2035; padding:20px 48px; }
.closing p, .closing div, .closing span { color:rgba(255,255,255,.7); font-size:12px; line-height:1.7; }
.footer { background:#1B2035; border-top:1px solid rgba(255,255,255,.08); padding:16px 48px; display:flex; justify-content:space-between; align-items:center; }
.footer-l { color:rgba(255,255,255,.3); font-size:10px; letter-spacing:.06em; text-transform:uppercase; }
.footer-r { color:rgba(255,255,255,.5); font-size:11px; }
.footer-r a { color:#DFF266; text-decoration:none; }
/* One-page continuous PDF — no forced page breaks */
@page { size: auto; margin: 0mm; }
@media print {
  html, body { height:auto; }
  .doc { max-width:100%; }
  * { page-break-inside: avoid; }
}
</style>
</head>
<body>
<div class="doc">
  <div class="header">
    <div class="header-top">
      ${logoSvg}
      <div class="conf">${confidential}</div>
    </div>
    <div class="prospect-label">${isSpanish ? "Preparado para:" : "Prepared for:"}</div>
    <div class="prospect-name">${p.formData.prospectName}</div>
    <div class="meta">${isSpanish ? "Fecha:" : "Date:"} ${date}${p.formData.websiteUrl ? ` &nbsp;|&nbsp; ${p.formData.websiteUrl}` : ""}</div>
  </div>
  <div class="tags">
    <span class="tags-label">${isSpanish ? "Servicios:" : "Services:"}</span>
    ${services}
  </div>
  <div class="body">
    ${sectionBlock(phase1Label, edited.phase1)}
    ${sectionBlock(phase2Label, edited.phase2)}
    ${sectionBlock(addLabel, edited.additional)}
    ${sectionBlock(feeLabel, edited.feeStructure, "fee-section")}
  </div>
  ${edited.closingNote && edited.closingNote.replace(/<[^>]*>/g, "").trim() ? `<div class="closing">${edited.closingNote}</div>` : ""}
  <div class="footer">
    <div class="footer-l">Zinnia Group © ${new Date().getFullYear()}</div>
    <div class="footer-r"><a href="mailto:leonardo@zinniagroup.io">leonardo@zinniagroup.io</a></div>
  </div>
</div>
</body>
</html>`;
  }

  function slug() {
    return proposal?.formData.prospectName.replace(/\s+/g, "-").toLowerCase() ?? "proposal";
  }

  function handleDownloadHTML() {
    if (!proposal) return;
    const blob = new Blob([buildPrintHTML()], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zinnia-proposal-${slug()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setDropdownOpen(false);
  }

  function handleDownloadPDF() {
    if (!proposal) return;
    setDropdownOpen(false);
    const html = buildPrintHTML();
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    // Measure real doc height after fonts load, set a single tall @page so
    // Chrome's "Save as PDF" produces one continuous page with no cuts
    setTimeout(() => {
      const docEl = win.document.documentElement;
      const docHeight = Math.max(docEl.scrollHeight, docEl.offsetHeight);
      const pageStyle = win.document.createElement("style");
      pageStyle.innerHTML = `@page { size: 794px ${docHeight}px; margin: 0; }`;
      win.document.head.appendChild(pageStyle);
      win.print();
    }, 900);
  }

  async function handleDownloadWord() {
    if (!proposal) return;
    setDownloading("word");
    setDropdownOpen(false);
    try {
      const payload = { ...proposal, editedHTML: getEditedHTML() };
      const res = await fetch("/api/export-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zinnia-proposal-${slug()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-[#E8EAF0] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#1B2035]/40" />
      </div>
    );
  }

  const { content, formData, template, generatedAt } = proposal;
  const date = new Date(generatedAt).toLocaleDateString(
    formData.language === "spanish" ? "es-ES" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );
  const isSpanish = formData.language === "spanish";

  const sectionClass = "bg-white rounded-lg mb-4 overflow-hidden shadow-sm";
  const sectionHeaderClass = "px-6 py-3 border-b border-[#E8EAF0] flex items-center gap-2";
  const sectionLabelClass = "text-[10px] font-bold uppercase tracking-widest text-[#1B2035]/40";
  const editableClass = "px-6 py-5 text-sm text-[#1B2035] leading-relaxed focus:outline-none min-h-[60px] [&_p]:mb-2 [&_ul]:list-none [&_li]:pl-4 [&_li]:relative [&_.zn-list_li]:before:content-[''] [&_.zn-list_li]:before:absolute [&_.zn-list_li]:before:left-0 [&_.zn-list_li]:before:top-[10px] [&_.zn-list_li]:before:w-[5px] [&_.zn-list_li]:before:h-[5px] [&_.zn-list_li]:before:bg-[#DFF266] [&_.zn-list_li]:before:rounded-full [&_.zn-label]:font-bold [&_.zn-label]:text-[#1B2035]";

  return (
    <div className="min-h-screen bg-[#E8EAF0]">
      {/* Top bar */}
      <header className="bg-[#1B2035] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={14} />
            Edit & Regenerate
          </button>
          <div className="w-px h-4 bg-white/20" />
          <Image src="/zinnia-logo-white.svg" alt="Zinnia" width={90} height={18} />
          <span className="text-white/40 text-sm">
            — <span className="text-white/80 font-medium">{formData.prospectName}</span>
            <span className="ml-2 text-[10px] text-white/25 uppercase tracking-widest">
              Template {template}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-all ${
              saved
                ? "bg-[#DFF266]/20 text-[#DFF266]"
                : "text-white/50 hover:text-white border border-white/20 hover:border-white/40"
            }`}
          >
            {saved ? <Check size={13} /> : null}
            {saved ? "Saved" : "Save edits"}
          </button>
          {/* Single Download dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 px-4 py-2 bg-[#DFF266] text-[#1B2035] font-semibold rounded text-sm hover:opacity-90 transition-opacity"
            >
              {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Download
              <ChevronDown size={13} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-xl border border-[#E8EAF0] overflow-hidden z-50">
                <button onClick={handleDownloadHTML} className="w-full text-left px-4 py-2.5 text-sm text-[#1B2035] hover:bg-[#E8EAF0] transition-colors">
                  HTML
                </button>
                <button onClick={handleDownloadPDF} className="w-full text-left px-4 py-2.5 text-sm text-[#1B2035] hover:bg-[#E8EAF0] transition-colors">
                  PDF
                </button>
                <button onClick={handleDownloadWord} disabled={!!downloading} className="w-full text-left px-4 py-2.5 text-sm text-[#1B2035] hover:bg-[#E8EAF0] transition-colors disabled:opacity-50">
                  {downloading === "word" ? "Generating…" : "Word"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Proposal header (non-editable) */}
        <div className="bg-[#1B2035] rounded-lg mb-4 overflow-hidden shadow-sm">
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <Image src="/zinnia-logo-white.svg" alt="Zinnia" width={120} height={24} />
              <span className="text-white/25 text-[10px] uppercase tracking-widest">
                {isSpanish ? "Estrictamente Confidencial" : "Strictly Confidential"}
              </span>
            </div>
            <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1">
              {isSpanish ? "Preparado para:" : "Prepared for:"}
            </div>
            <div className="text-[#DFF266] text-3xl font-bold mb-3">{formData.prospectName}</div>
            <div className="text-white/40 text-xs">{date}{formData.websiteUrl ? ` · ${formData.websiteUrl}` : ""}</div>
          </div>
          <div className="bg-[#2A3150] px-8 py-3 flex flex-wrap gap-2 items-center">
            <span className="text-white/25 text-[10px] uppercase tracking-widest mr-1">
              {isSpanish ? "Servicios:" : "Services:"}
            </span>
            {formData.services.map((s) => (
              <span key={s} className="bg-[#DFF266]/10 text-[#DFF266] text-[10px] px-2 py-1 rounded font-medium">
                {SERVICE_LABELS[s]}
              </span>
            ))}
            {formData.customService?.trim() && (
              <span className="bg-[#DFF266]/10 text-[#DFF266] text-[10px] px-2 py-1 rounded font-medium">
                {formData.customService}
              </span>
            )}
          </div>
        </div>

        {/* Edit hint */}
        <div className="mb-4 px-1">
          <span className="text-[11px] text-[#1B2035]/40">
            Click on any section below to edit directly before downloading.
          </span>
        </div>

        {/* Editable sections — HTML set via useEffect, NOT dangerouslySetInnerHTML */}
        <div className={sectionClass}>
          <div className={sectionHeaderClass}>
            <span className={sectionLabelClass}>
              {isSpanish ? "Fase 1: Alineación Estratégica de Marca" : "Phase 1: Essential Brand Strategy Alignment"}
            </span>
          </div>
          <div ref={phase1Ref} contentEditable suppressContentEditableWarning className={editableClass} />
        </div>

        <div className={sectionClass}>
          <div className={sectionHeaderClass}>
            <span className={sectionLabelClass}>
              {isSpanish ? "Fase 2: Posicionamiento en LinkedIn" : "Phase 2: LinkedIn Positioning Essentials"}
            </span>
          </div>
          <div ref={phase2Ref} contentEditable suppressContentEditableWarning className={editableClass} />
        </div>

        {content.additional?.trim() && (
          <div className={sectionClass}>
            <div className={sectionHeaderClass}>
              <span className={sectionLabelClass}>
                {isSpanish ? "Servicios Adicionales" : "Additional Essentials"}
              </span>
            </div>
            <div ref={additionalRef} contentEditable suppressContentEditableWarning className={editableClass} />
          </div>
        )}

        <div className={`${sectionClass} border-l-4 border-[#DFF266]`}>
          <div className={sectionHeaderClass}>
            <span className={sectionLabelClass}>
              {isSpanish ? "Estructura de Honorarios" : "Fee Structure & Breakdown"}
            </span>
          </div>
          <div ref={feeRef} contentEditable suppressContentEditableWarning className={`${editableClass} bg-[#F7F8FC]`} />
        </div>

        {content.closingNote?.trim() && (
          <div className="bg-[#1B2035] rounded-lg mb-4 px-6 py-5">
            <div
              ref={closingRef}
              contentEditable
              suppressContentEditableWarning
              className="text-sm text-white/70 leading-relaxed focus:outline-none"
            />
          </div>
        )}

        {/* Footer */}
        <div className="bg-[#1B2035] rounded-lg px-6 py-4 flex items-center justify-between">
          <span className="text-white/25 text-[10px] uppercase tracking-widest">Zinnia Group © {new Date().getFullYear()}</span>
          <a href="mailto:leonardo@zinniagroup.io" className="text-[#DFF266] text-xs">
            leonardo@zinniagroup.io
          </a>
        </div>

        {/* Bottom CTA */}
        <div className="mt-6 flex justify-center">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 px-7 py-3 bg-[#1B2035] text-[#DFF266] font-semibold rounded-lg text-sm hover:bg-[#2A3150] transition-colors"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download
              <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-44 bg-white rounded-lg shadow-xl border border-[#E8EAF0] overflow-hidden z-50">
                <button onClick={handleDownloadHTML} className="w-full text-left px-4 py-2.5 text-sm text-[#1B2035] hover:bg-[#E8EAF0] transition-colors">
                  HTML
                </button>
                <button onClick={handleDownloadPDF} className="w-full text-left px-4 py-2.5 text-sm text-[#1B2035] hover:bg-[#E8EAF0] transition-colors">
                  PDF
                </button>
                <button onClick={handleDownloadWord} disabled={!!downloading} className="w-full text-left px-4 py-2.5 text-sm text-[#1B2035] hover:bg-[#E8EAF0] transition-colors disabled:opacity-50">
                  {downloading === "word" ? "Generating…" : "Word"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
