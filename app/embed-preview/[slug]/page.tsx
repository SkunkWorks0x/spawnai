"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function EmbedPreview() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const color = searchParams.get("color") || "#6366f1";
  const position = searchParams.get("position") || "bottom-right";
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    const script = document.createElement("script");
    script.src = "/embed.js";
    script.setAttribute("data-agent", slug);
    script.setAttribute("data-color", color);
    script.setAttribute("data-position", position);
    document.body.appendChild(script);

    return () => {
      // Cleanup widget on unmount
      const widget = document.getElementById("spawnai-widget");
      if (widget) widget.remove();
    };
  }, [slug, color, position]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{ textAlign: "center", color: "#94a3b8" }}>
        <p style={{ fontSize: 14 }}>This is a preview of your embedded widget.</p>
        <p style={{ fontSize: 13, marginTop: 4 }}>Click the chat bubble to try it out.</p>
      </div>
    </div>
  );
}
