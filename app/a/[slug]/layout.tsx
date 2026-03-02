import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agents")
    .select("config")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!data) {
    return { title: "Agent Not Found — SpawnAI" };
  }

  const config = data.config as { name: string; short_description: string };
  const title = `${config.name} — SpawnAI Agent`;
  const description = config.short_description || "An AI agent powered by SpawnAI.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "SpawnAI",
    },
    twitter: {
      card: "summary",
      title,
      description,
      creator: "@Skunkworks0x",
    },
  };
}

export default function AgentLayout({ children }: Props) {
  return children;
}
