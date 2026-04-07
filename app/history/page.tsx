"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, FileText, Trash2, ExternalLink, Search, Loader2 } from "lucide-react";

const SERVICE_LABELS: Record<string, string> = {
  linkedin_management: "LinkedIn Management",
  full_stack: "Full Stack",
  marketing_strategy: "Marketing Strategy",
  website_development: "Website Dev",
  executive_positioning: "Executive Positioning",
  one_pager: "One Pager",
  brand_manual: "Brand Manual",
  media_amplification: "Media Amplification",
};

interface SavedProposal {
  id: string;
  prospect_name: string;
  prospect_slug: string;
  language: string;
  services: string[];
  template: string;
  form_data: Record<string, unknown>;
  generated_at: string;
  created_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<SavedProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/proposals")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProposals(data);
        else setError(data.error ?? "Failed to load history");
      })
      .catch(() => setError("Failed to connect to database"))
      .finally(() => setLoading(false));
  }, []);

  async function handleOpen(id: string) {
    const res = await fetch(`/api/proposals/${id}`);
    const data = await res.json();
    if (data.error) return;

    // Map DB record → GeneratedProposal shape expected by /proposal page
    const proposal = {
      template: data.template,
      content: data.content,
      formData: data.form_data,
      generatedAt: data.generated_at,
      editedHTML: data.edited_html ?? undefined,
    };
    sessionStorage.setItem("zinnia_proposal", JSON.stringify(proposal));
    router.push("/proposal");
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this proposal?")) return;
    setDeleting(id);
    await fetch(`/api/proposals/${id}`, { method: "DELETE" });
    setProposals((prev) => prev.filter((p) => p.id !== id));
    setDeleting(null);
  }

  const filtered = proposals.filter((p) =>
    p.prospect_name.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="min-h-screen bg-[#E8EAF0]">
      <header className="bg-[#1B2035] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={14} />
            New Proposal
          </button>
          <div className="w-px h-4 bg-white/20" />
          <Image src="/zinnia-logo-white.svg" alt="Zinnia" width={90} height={18} />
          <span className="text-white/40 text-sm">— Proposal History</span>
        </div>
        <div className="text-white/30 text-xs uppercase tracking-widest">
          {proposals.length} proposal{proposals.length !== 1 ? "s" : ""}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="relative mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1B2035]/30" />
          <input
            type="text"
            placeholder="Search by prospect name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white rounded-lg border border-[#1B2035]/10 text-sm text-[#1B2035] placeholder:text-[#1B2035]/30 focus:outline-none focus:border-[#1B2035]/30"
          />
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="animate-spin text-[#1B2035]/30" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
            {error.includes("table") && (
              <p className="mt-1 text-xs text-red-500">Run the SQL migration in Supabase to create the <code>saved_proposals</code> table.</p>
            )}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-[#1B2035]/5 p-16 flex flex-col items-center text-center">
            <FileText size={48} className="text-[#1B2035]/15 mb-4" />
            <p className="font-semibold text-[#1B2035]">
              {search ? "No proposals match your search" : "No proposals saved yet"}
            </p>
            <p className="text-sm text-[#1B2035]/40 mt-1">
              {search ? "Try a different name." : "Generate your first proposal and it will appear here."}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => handleOpen(p.id)}
                className="bg-white rounded-xl shadow-sm border border-[#1B2035]/5 px-5 py-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-[#1B2035]/15 transition-all group"
              >
                {/* Template badge */}
                <div className="w-9 h-9 rounded-lg bg-[#1B2035] flex items-center justify-center shrink-0">
                  <span className="text-[#DFF266] text-xs font-bold">{p.template}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#1B2035] text-sm truncate">{p.prospect_name}</p>
                    {p.language === "spanish" && (
                      <span className="text-[10px] text-[#1B2035]/40 border border-[#1B2035]/15 px-1.5 py-0.5 rounded shrink-0">ES</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(p.services ?? []).slice(0, 4).map((s) => (
                      <span key={s} className="text-[10px] bg-[#E8EAF0] text-[#1B2035]/60 px-2 py-0.5 rounded">
                        {SERVICE_LABELS[s] ?? s}
                      </span>
                    ))}
                    {(p.services ?? []).length > 4 && (
                      <span className="text-[10px] text-[#1B2035]/30">+{p.services.length - 4}</span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs text-[#1B2035]/40">{formatDate(p.created_at)}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpen(p.id); }}
                    className="p-1.5 text-[#1B2035]/40 hover:text-[#1B2035] hover:bg-[#E8EAF0] rounded transition-colors"
                    title="Open"
                  >
                    <ExternalLink size={13} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(p.id, e)}
                    disabled={deleting === p.id}
                    className="p-1.5 text-[#1B2035]/40 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    {deleting === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
