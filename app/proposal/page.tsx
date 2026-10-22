"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Download, ArrowLeft, Loader2, Check, ChevronDown } from "lucide-react";
import type { GeneratedProposal } from "@/types/proposal";
import { buildPrintHTML, buildProposalModel, cleanText, printTitle } from "@/lib/printProposal";

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
    const t = cleanText(line.trim());
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
  const [dropdownTop, setDropdownTop] = useState(false);
  const [dropdownBottom, setDropdownBottom] = useState(false);
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
      closingRef.current.innerHTML = src?.closingNote ?? (proposal.content.closingNote ? `<p>${cleanText(proposal.content.closingNote)}</p>` : "");
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

  function model() {
    return buildProposalModel(proposal!, getEditedHTML(), SERVICE_LABELS);
  }

  function printHTML(): string {
    if (!proposal) return "";
    return buildPrintHTML(model());
  }

  function slug() {
    return proposal?.formData.prospectName.replace(/\s+/g, "-").toLowerCase() ?? "proposal";
  }

  function handleDownloadHTML() {
    if (!proposal) return;
    const blob = new Blob([printHTML()], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zinnia-proposal-${slug()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setDropdownTop(false); setDropdownBottom(false);
  }

  function handleDownloadPDF() {
    if (!proposal) return;
    setDropdownTop(false); setDropdownBottom(false);
    // Print from a hidden iframe so the dialog opens over the app instead of a new tab
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(frame);
    const win = frame.contentWindow;
    if (!win) { frame.remove(); return; }
    win.document.open();
    win.document.write(printHTML());
    win.document.close();
    // Chrome names the saved PDF after the top document's title
    const prevTitle = document.title;
    document.title = printTitle(model());
    const cleanup = () => { document.title = prevTitle; frame.remove(); };
    const go = () => {
      win.addEventListener("afterprint", () => setTimeout(cleanup, 0), { once: true });
      win.focus();
      win.print();
    };
    const fontsReady = win.document.fonts?.ready ?? Promise.resolve();
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]).then(() => setTimeout(go, 150));
  }

  async function handleDownloadWord() {
    if (!proposal) return;
    setDownloading("word");
    setDropdownTop(false); setDropdownBottom(false);
    try {
      const payload = { model: model() };
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
            New Proposal
          </button>
          <button
            onClick={() => router.push("/history")}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
            History
          </button>
          <div className="w-px h-4 bg-white/20" />
          <Image src="/zinnia-logo-white.svg" alt="Zinnia" width={90} height={18} />
          <span className="text-white/40 text-sm">
            | <span className="text-white/80 font-medium">{formData.prospectName}</span>
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
              onClick={() => setDropdownTop((o) => !o)}
              className="flex items-center gap-2 px-4 py-2 bg-[#DFF266] text-[#1B2035] font-semibold rounded text-sm hover:opacity-90 transition-opacity"
            >
              {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Download
              <ChevronDown size={13} className={`transition-transform ${dropdownTop ? "rotate-180" : ""}`} />
            </button>
            {dropdownTop && (
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
            <div className="text-white/40 text-xs">{date}{formData.websiteUrl ? ` | ${formData.websiteUrl}` : ""}</div>
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

        <div className={sectionClass}>
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
              onClick={() => setDropdownBottom((o) => !o)}
              className="flex items-center gap-2 px-7 py-3 bg-[#1B2035] text-[#DFF266] font-semibold rounded-lg text-sm hover:bg-[#2A3150] transition-colors"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download
              <ChevronDown size={14} className={`transition-transform ${dropdownBottom ? "rotate-180" : ""}`} />
            </button>
            {dropdownBottom && (
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
