"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Globe,
  Linkedin,
  User,
  FileText,
  DollarSign,
  Loader2,
  Zap,
  Plus,
  Sparkles,
} from "lucide-react";
import type {
  ProposalFormData,
  Language,
  ProspectProfile,
  Service,
} from "@/types/proposal";

const SERVICE_OPTIONS: { value: Service; label: string }[] = [
  { value: "linkedin_management", label: "LinkedIn Management (Essential)" },
  { value: "full_stack", label: "Full Stack (Brand + LinkedIn)" },
  { value: "marketing_strategy", label: "Tailored Marketing Strategy & Plan" },
  { value: "website_development", label: "Website Development" },
  { value: "executive_positioning", label: "Executive Positioning (individual)" },
  { value: "one_pager", label: "One Pager / Teaser" },
  { value: "brand_manual", label: "Brand Manual" },
  { value: "media_amplification", label: "Zinnia Media Amplification" },
];

const PROFILE_OPTIONS: { value: ProspectProfile; label: string; description: string }[] = [
  { value: "no_digital_presence", label: "No structured digital presence", description: "Building from scratch — no cohesive brand or content" },
  { value: "basic_presence", label: "Basic established presence", description: "Has some presence but wants to scale" },
  { value: "solid_presence", label: "Solid presence, seeking dominance", description: "Well-established — wants to outpace competitors" },
];

const defaultForm: ProposalFormData = {
  prospectName: "",
  websiteUrl: "",
  linkedinUrl: "",
  language: "english",
  prospectProfile: "",
  services: [],
  customService: "",
  notes: "",
  suggestedPrice: "",
};

export default function HomePage() {
  const router = useRouter();
  const [form, setForm] = useState<ProposalFormData>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");
  const [suggested, setSuggested] = useState(false);

  function toggleService(service: Service) {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service],
    }));
  }

  async function handleAutoSuggest() {
    if (!form.prospectName.trim()) {
      setError("Enter the prospect name first.");
      return;
    }
    setError("");
    setSuggesting(true);
    try {
      const res = await fetch("/api/suggest-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectName: form.prospectName,
          websiteUrl: form.websiteUrl,
          linkedinUrl: form.linkedinUrl,
        }),
      });
      if (!res.ok) throw new Error();
      const suggestions = await res.json();
      setForm((prev) => ({
        ...prev,
        prospectProfile: suggestions.prospectProfile || prev.prospectProfile,
        services: suggestions.services?.length ? suggestions.services : prev.services,
        suggestedPrice: suggestions.suggestedPrice || prev.suggestedPrice,
        notes: suggestions.notes || prev.notes,
        language: suggestions.language || prev.language,
      }));
      setSuggested(true);
    } catch {
      setError("Auto-suggest failed. Fill manually.");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.prospectName.trim()) { setError("Prospect name is required."); return; }
    if (form.services.length === 0) { setError("Select at least one service."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/generate-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      sessionStorage.setItem("zinnia_proposal", JSON.stringify(data));
      router.push("/proposal");
    } catch {
      setError("Failed to generate proposal. Check your API key and try again.");
    } finally {
      setLoading(false);
    }
  }

  const cardClass = "bg-white rounded-lg p-6 shadow-sm";
  const labelClass = "block text-[10px] font-bold uppercase tracking-widest text-[#1B2035]/50 mb-3";
  const inputClass = "w-full pl-9 pr-4 py-3 border border-[#E8EAF0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#DFF266] focus:border-transparent text-[#1B2035] placeholder:text-[#1B2035]/30";

  return (
    <div className="min-h-screen bg-[#E8EAF0]">
      <header className="bg-[#1B2035] px-8 py-4 flex items-center gap-4">
        <Image src="/zinnia-logo-white.svg" alt="Zinnia" width={120} height={24} priority />
        <span className="text-white/30 text-sm">— Proposal Generator</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1B2035] tracking-tight">New Proposal</h1>
          <p className="text-[#1B2035]/40 mt-1 text-sm">Enter the prospect's info and we'll pre-fill the rest. Review, adjust, and generate.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prospect info + AI suggest */}
          <div className={cardClass}>
            <label className={labelClass}>Prospect Information</label>
            <div className="space-y-3">
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1B2035]/30" />
                <input
                  type="text"
                  placeholder="Prospect / Company name *"
                  value={form.prospectName}
                  onChange={(e) => { setForm((p) => ({ ...p, prospectName: e.target.value })); setSuggested(false); }}
                  className={inputClass}
                  required
                />
              </div>
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1B2035]/30" />
                <input
                  type="url"
                  placeholder="Website URL"
                  value={form.websiteUrl}
                  onChange={(e) => setForm((p) => ({ ...p, websiteUrl: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="relative">
                <Linkedin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1B2035]/30" />
                <input
                  type="url"
                  placeholder="LinkedIn URL"
                  value={form.linkedinUrl}
                  onChange={(e) => setForm((p) => ({ ...p, linkedinUrl: e.target.value }))}
                  className={inputClass}
                />
              </div>

              {/* AI Suggest button */}
              <button
                type="button"
                onClick={handleAutoSuggest}
                disabled={suggesting || !form.prospectName.trim()}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all border ${
                  suggested
                    ? "border-[#DFF266] bg-[#DFF266]/10 text-[#1B2035]"
                    : "border-dashed border-[#1B2035]/20 text-[#1B2035]/50 hover:border-[#1B2035]/40 hover:text-[#1B2035] disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                {suggesting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                {suggesting ? "Analyzing prospect..." : suggested ? "Suggestions applied — review below" : "Auto-suggest profile, services & price"}
              </button>
            </div>
          </div>

          {/* Language */}
          <div className={cardClass}>
            <label className={labelClass}>Proposal Language</label>
            <div className="flex bg-[#E8EAF0] rounded-md p-1 w-fit">
              {(["english", "spanish"] as Language[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, language: lang }))}
                  className={`px-5 py-2 rounded text-sm font-medium transition-all ${
                    form.language === lang ? "bg-[#1B2035] text-white shadow-sm" : "text-[#1B2035]/50 hover:text-[#1B2035]"
                  }`}
                >
                  {lang === "english" ? "English" : "Español"}
                </button>
              ))}
            </div>
            {form.language === "spanish" && (
              <p className="mt-2 text-[11px] text-[#1B2035]/40">Template C (Atraer / Nutrir / Convertir) will be used.</p>
            )}
          </div>

          {/* Prospect Profile */}
          <div className={cardClass}>
            <label className={labelClass}>Prospect Profile</label>
            <div className="space-y-2">
              {PROFILE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3.5 rounded-md border cursor-pointer transition-all ${
                    form.prospectProfile === opt.value
                      ? "border-[#1B2035] bg-[#1B2035]/[0.03]"
                      : "border-[#E8EAF0] hover:border-[#1B2035]/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="profile"
                    value={opt.value}
                    checked={form.prospectProfile === opt.value}
                    onChange={() => setForm((p) => ({ ...p, prospectProfile: opt.value }))}
                    className="mt-0.5 accent-[#1B2035]"
                  />
                  <div>
                    <div className="text-sm font-medium text-[#1B2035]">{opt.label}</div>
                    <div className="text-[11px] text-[#1B2035]/40 mt-0.5">{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className={cardClass}>
            <label className={labelClass}>Services to Include</label>
            <div className="grid grid-cols-1 gap-2">
              {SERVICE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all ${
                    form.services.includes(opt.value)
                      ? "border-[#DFF266] bg-[#DFF266]/[0.08]"
                      : "border-[#E8EAF0] hover:border-[#1B2035]/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.services.includes(opt.value)}
                    onChange={() => toggleService(opt.value)}
                    className="accent-[#1B2035]"
                  />
                  <span className="text-sm text-[#1B2035]">{opt.label}</span>
                </label>
              ))}
              {/* Custom service */}
              <div className="relative mt-1">
                <Plus size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1B2035]/30" />
                <input
                  type="text"
                  placeholder="Add a custom service..."
                  value={form.customService}
                  onChange={(e) => setForm((p) => ({ ...p, customService: e.target.value }))}
                  className="w-full pl-8 pr-4 py-3 border border-dashed border-[#1B2035]/20 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#DFF266] focus:border-transparent text-[#1B2035] placeholder:text-[#1B2035]/30"
                />
              </div>
            </div>
          </div>

          {/* Notes + Price */}
          <div className={`${cardClass} space-y-4`}>
            <div>
              <label className={labelClass}>
                <FileText size={11} className="inline mr-1" />
                Notes / Pain Points
              </label>
              <textarea
                rows={3}
                placeholder="Pain points, context, anything specific to include..."
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full px-4 py-3 border border-[#E8EAF0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#DFF266] focus:border-transparent text-[#1B2035] placeholder:text-[#1B2035]/30 resize-none"
              />
            </div>
            <div>
              <label className={labelClass}>
                <DollarSign size={11} className="inline mr-1" />
                Suggested Price
              </label>
              <div className="relative w-44">
                <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1B2035]/30" />
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.suggestedPrice}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, suggestedPrice: e.target.value ? Number(e.target.value) : "" }))
                  }
                  className="w-full pl-9 pr-10 py-3 border border-[#E8EAF0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#DFF266] focus:border-transparent text-[#1B2035] placeholder:text-[#1B2035]/30"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#1B2035]/30">/mo</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1B2035] text-[#DFF266] font-semibold py-4 rounded-lg text-sm tracking-wide uppercase hover:bg-[#2A3150] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 size={15} className="animate-spin" /> Generating proposal...</>
            ) : (
              <><Zap size={15} /> Generate Proposal</>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
