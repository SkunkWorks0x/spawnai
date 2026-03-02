import { createAdminClient } from "@/lib/supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("agents")
      .select("slug, config, status, public")
      .eq("slug", slug)
      .single();

    if (error || !data || data.status !== "active" || !data.public) {
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = data.config as {
      name?: string;
      short_description?: string;
      welcome_message?: string;
    };

    return new Response(
      JSON.stringify({
        name: config.name || slug,
        slug: data.slug,
        short_description: config.short_description || "",
        welcome_message: config.welcome_message || "Hi! How can I help?",
        status: data.status,
        color: "#6366f1",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[agents/slug] error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
