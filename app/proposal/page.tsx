"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Download, ArrowLeft, Loader2, Check, ChevronDown } from "lucide-react";
import type { GeneratedProposal } from "@/types/proposal";
import {
  MEMO_CSS,
  MEMO_FONTS_HREF,
  blocksHTML,
  buildPrintHTML,
  buildProposalModel,
  cleanText,
  closingHTML,
  memoHeaderHTML,
  printTitle,
  screenFooterHTML,
  signHTML,
  type EditedSections,
  type ProposalModel,
  type SectionKey,
} from "@/lib/printProposal";

// Editing affordances on top of the shared memo styles (screen only)
const EDITOR_CSS = `
.memo.editing [contenteditable] { outline:none; border-radius:3px; transition:box-shadow .15s ease-out; cursor:text; }
.memo.editing [contenteditable]:hover { box-shadow:0 0 0 5px #fff, 0 0 0 6px rgba(27,32,53,.14); }
.memo.editing [contenteditable]:focus { box-shadow:0 0 0 5px #fff, 0 0 0 7px #C9D94F; }
.memo.editing .fee .body[contenteditable]:hover, .memo.editing .fee .body[contenteditable]:focus { box-shadow:0 0 0 2px #C9D94F; }
`;

const SECTION_KEYS: SectionKey[] = ["phase1", "phase2", "additional", "feeStructure"];

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

  const [layout, setLayout] = useState<ProposalModel | null>(null);
  const [headerHTML, setHeaderHTML] = useState("");
  const bodyRefs = useRef<Partial<Record<SectionKey, HTMLDivElement | null>>>({});
  const titleRefs = useRef<Partial<Record<SectionKey, HTMLHeadingElement | null>>>({});
  const closingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("zinnia_proposal");
    if (!stored) { router.replace("/"); return; }
    const data = JSON.parse(stored) as GeneratedProposal & { editedHTML?: EditedSections };
    setProposal(data);
  }, [router]);

  // Build the memo layout once from the AI content (or saved edits)
  useEffect(() => {
    if (!proposal) return;
    const src = (proposal as GeneratedProposal & { editedHTML?: EditedSections }).editedHTML;
    const initial: EditedSections = src ?? {
      phase1: formatContent(proposal.content.phase1),
      phase2: formatContent(proposal.content.phase2),
      additional: formatContent(proposal.content.additional),
      feeStructure: formatContent(proposal.content.feeStructure),
      closingNote: proposal.content.closingNote ? `<p>${cleanText(proposal.content.closingNote)}</p>` : "",
    };
    const m = buildProposalModel(proposal, initial, SERVICE_LABELS);
    setLayout(m);
    setHeaderHTML(memoHeaderHTML(m));
  }, [proposal]);

  // Fill the editable regions via refs (NOT dangerouslySetInnerHTML) so React
  // never overwrites Leo's edits on re-render
  useEffect(() => {
    if (!layout) return;
    for (const s of layout.sections) {
      const body = bodyRefs.current[s.key];
      const title = titleRefs.current[s.key];
      if (body) body.innerHTML = blocksHTML(s.blocks);
      if (title) title.textContent = s.title;
    }
    if (closingRef.current) closingRef.current.innerHTML = closingHTML(layout);
  }, [layout]);

  function getEditedHTML(): EditedSections {
    const edited: EditedSections = { phase1: "", phase2: "", additional: "", feeStructure: "", closingNote: "", titles: {} };
    for (const key of SECTION_KEYS) {
      edited[key] = bodyRefs.current[key]?.innerHTML || "";
      const t = titleRefs.current[key]?.textContent?.trim();
      if (t) edited.titles![key] = t;
    }
    edited.closingNote = closingRef.current?.innerHTML || "";
    return edited;
  }

  // Investment row in the header follows edits to the fee section
  function refreshHeader() {
    if (!proposal) return;
    setHeaderHTML(memoHeaderHTML(buildProposalModel(proposal, getEditedHTML(), SERVICE_LABELS)));
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

  const { formData, template } = proposal;
  const isSpanish = formData.language === "spanish";

  return (
    <div className="min-h-screen bg-[#E6E8EE]">
      <link rel="stylesheet" href={MEMO_FONTS_HREF} />
      <style>{MEMO_CSS + EDITOR_CSS}</style>
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

      <div className="px-4 py-8 overflow-x-auto">
        <p className="text-center text-[12px] text-[#1B2035]/55 mb-4">
          {isSpanish
            ? "Así se imprime y se descarga. Haz clic en cualquier título o texto para editarlo."
            : "This is exactly how it prints and downloads. Click any heading or text to edit it."}
        </p>

        {layout && (
          <main className="memo editing" onInput={refreshHeader}>
            <div dangerouslySetInnerHTML={{ __html: headerHTML }} />
            {layout.sections.map((s) => (
              <section key={s.key} className={`sec ${s.kind}`}>
                <div className="gut">
                  <div className="num">{s.num}</div>
                  <div className="gl">{s.gutter}</div>
                </div>
                <h2
                  ref={(el) => { titleRefs.current[s.key] = el; }}
                  contentEditable
                  suppressContentEditableWarning
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                />
                <div
                  className="body"
                  ref={(el) => { bodyRefs.current[s.key] = el; }}
                  contentEditable
                  suppressContentEditableWarning
                />
              </section>
            ))}
            {layout.closing.length > 0 && (
              <section className="closing">
                <div ref={closingRef} contentEditable suppressContentEditableWarning />
                <div dangerouslySetInnerHTML={{ __html: signHTML(layout) }} />
              </section>
            )}
            <div dangerouslySetInnerHTML={{ __html: screenFooterHTML(layout) }} />
          </main>
        )}

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
