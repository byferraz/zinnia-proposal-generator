"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, FileText, Trash2, ExternalLink, Search, Loader2, ChevronDown, ChevronUp } from "lucide-react";

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

interface ClientGroup {
  slug: string;
  name: string;
  proposals: SavedProposal[];
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

function ProposalCard({
  p,
  onOpen,
  onDelete,
  deleting,
}: {
  p: SavedProposal;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <div className="bg-[#F7F8FC] rounded-lg border border-[#1B2035]/5 p-4 flex flex-col gap-3">
      <div>
        <div className="flex flex-wrap gap-1">
          {(p.services ?? []).map((s) => (
            <span key={s} className="text-[10px] bg-white border border-[#1B2035]/10 text-[#1B2035]/60 px-2 py-0.5 rounded">
              {SERVICE_LABELS[s] ?? s}
            </span>
          ))}
          {p.language === "spanish" && (
            <span className="text-[10px] bg-[#DFF266]/20 text-[#1B2035]/60 px-2 py-0.5 rounded border border-[#DFF266]/40">ES</span>
          )}
        </div>
        <p className="text-[11px] text-[#1B2035]/35 mt-2">{formatDate(p.created_at)}</p>
      </div>
      <div className="flex gap-2 pt-1 border-t border-[#1B2035]/5">
        <button
          onClick={() => onOpen(p.id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1B2035] text-[#DFF266] text-xs font-semibold rounded hover:bg-[#2A3150] transition-colors"
        >
          <ExternalLink size={11} />
          Open
        </button>
        <button
          onClick={() => onDelete(p.id)}
          disabled={deleting}
          className="flex items-center justify-center gap-1.5 px-3 py-2 border border-red-200 text-red-400 text-xs font-semibold rounded hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
        >
          {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          Delete
        </button>
      </div>
    </div>
  );
}

function ClientSection({
  group,
  onOpen,
  onDelete,
  deleting,
}: {
  group: ClientGroup;
  onOpen: (id: string) => void;
  onDelete: (id: string, slug: string) => void;
  deleting: string | null;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#1B2035]/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#F7F8FC] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1B2035] flex items-center justify-center text-[#DFF266] text-sm font-bold shrink-0">
            {group.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-semibold text-[#1B2035] text-sm">{group.name}</p>
            <p className="text-[11px] text-[#1B2035]/40">
              {group.proposals.length} proposal{group.proposals.length !== 1 ? "s" : ""} · last {formatDate(group.proposals[0].created_at)}
            </p>
          </div>
        </div>
        {open ? <ChevronUp size={15} className="text-[#1B2035]/30" /> : <ChevronDown size={15} className="text-[#1B2035]/30" />}
      </button>

      {open && (
        <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {group.proposals.map((p) => (
            <ProposalCard
              key={p.id}
              p={p}
              onOpen={onOpen}
              onDelete={(id) => onDelete(id, group.slug)}
              deleting={deleting === p.id}
            />
          ))}
        </div>
      )}
    </div>
  );
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

  async function handleDelete(id: string) {
    if (!confirm("Delete this proposal?")) return;
    setDeleting(id);
    await fetch(`/api/proposals/${id}`, { method: "DELETE" });
    setProposals((prev) => prev.filter((p) => p.id !== id));
    setDeleting(null);
  }

  // Group by prospect_slug, preserve order (most recent first)
  const groups: ClientGroup[] = [];
  const seen = new Map<string, number>();
  for (const p of proposals) {
    if (!seen.has(p.prospect_slug)) {
      seen.set(p.prospect_slug, groups.length);
      groups.push({ slug: p.prospect_slug, name: p.prospect_name, proposals: [] });
    }
    groups[seen.get(p.prospect_slug)!].proposals.push(p);
  }

  const filtered = search.trim()
    ? groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : groups;

  return (
    <div className="min-h-screen bg-[#E8EAF0]">
      <header className="bg-[#1B2035] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/")} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
            <ArrowLeft size={14} />
            New Proposal
          </button>
          <div className="w-px h-4 bg-white/20" />
          <Image src="/zinnia-logo-white.svg" alt="Zinnia" width={90} height={18} />
          <span className="text-white/40 text-sm">— Proposal History</span>
        </div>
        <div className="text-white/30 text-xs uppercase tracking-widest">
          {groups.length} client{groups.length !== 1 ? "s" : ""} · {proposals.length} proposal{proposals.length !== 1 ? "s" : ""}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="relative mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1B2035]/30" />
          <input
            type="text"
            placeholder="Search by prospect..."
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
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-16 flex flex-col items-center text-center">
            <FileText size={48} className="text-[#1B2035]/15 mb-4" />
            <p className="font-semibold text-[#1B2035]">
              {search ? "No prospects match your search" : "No proposals saved yet"}
            </p>
            <p className="text-sm text-[#1B2035]/40 mt-1">
              {search ? "Try a different name." : "Generate your first proposal and it will appear here automatically."}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((group) => (
              <ClientSection
                key={group.slug}
                group={group}
                onOpen={handleOpen}
                onDelete={handleDelete}
                deleting={deleting}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
