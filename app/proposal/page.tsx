"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Printer, ArrowLeft, Loader2, Zap } from "lucide-react";
import type { GeneratedProposal } from "@/types/proposal";
import { generateProposalHTML } from "@/lib/generateProposalHTML";

export default function ProposalPage() {
  const router = useRouter();
  const [proposal, setProposal] = useState<GeneratedProposal | null>(null);
  const [htmlContent, setHtmlContent] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("zinnia_proposal");
    if (!stored) {
      router.replace("/");
      return;
    }
    const data = JSON.parse(stored) as GeneratedProposal;
    setProposal(data);
    setHtmlContent(generateProposalHTML(data));
  }, [router]);

  function handleDownload() {
    if (!proposal) return;
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zinnia-proposal-${proposal.formData.prospectName.replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(htmlContent);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-[#E8EAF0] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#1B2035]/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8EAF0]">
      {/* Top bar */}
      <header className="bg-[#1B2035] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={15} />
            Edit & Regenerate
          </button>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#DFF266] rounded flex items-center justify-center">
              <Zap size={12} color="#1B2035" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-sm">
              Proposal for{" "}
              <span className="text-white font-semibold">
                {proposal.formData.prospectName}
              </span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded text-sm transition-all"
          >
            <Download size={14} />
            Download HTML
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-[#DFF266] text-[#1B2035] font-semibold rounded text-sm hover:opacity-90 transition-opacity"
          >
            <Printer size={14} />
            Print / Save as PDF
          </button>
        </div>
      </header>

      {/* Template badge */}
      <div className="bg-[#2A3150] px-6 py-2 flex items-center gap-3">
        <span className="text-white/30 text-xs uppercase tracking-widest">Template</span>
        <span className="text-[#DFF266] text-xs font-bold tracking-widest">
          {proposal.template === "A"
            ? "A — Building the Foundations"
            : proposal.template === "B"
              ? "B — Full Stack"
              : "C — Atraer / Nutrir / Convertir"}
        </span>
      </div>

      {/* Preview iframe */}
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          <iframe
            srcDoc={htmlContent}
            className="w-full bg-white shadow-xl"
            style={{ height: "calc(100vh - 140px)", border: "none", borderRadius: "8px" }}
            title="Proposal Preview"
          />
        </div>
      </div>
    </div>
  );
}
