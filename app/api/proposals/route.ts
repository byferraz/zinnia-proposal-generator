import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — list all saved proposals
export async function GET() {
  const { data, error } = await supabase()
    .from("saved_proposals")
    .select("id, prospect_name, prospect_slug, language, services, template, form_data, generated_at, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST — save a proposal
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { prospectName, prospectSlug, language, services, template, content, formData, editedHTML, generatedAt } = body;

  if (!prospectName || !template || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabase()
    .from("saved_proposals")
    .insert({
      prospect_name: prospectName,
      prospect_slug: prospectSlug,
      language: language ?? "english",
      services: services ?? [],
      template,
      content,
      form_data: formData,
      edited_html: editedHTML ?? null,
      generated_at: generatedAt ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data?.id });
}
