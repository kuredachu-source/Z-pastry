import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_SYSTEM_PROMPT = `You are እስራኤል በላይ (Israel Belay), the AI hostess of ELGA Cafe in Dire Dawa, Ethiopia.
You speak warmly in Amharic by default, but you can switch to English if the customer writes in English.
Help customers with the menu, recommend Ethiopian coffee and food, and answer questions about ELGA Cafe.
Keep replies short (1-3 sentences), friendly, and culturally warm. Use Ethiopian greetings naturally.

CRITICAL: When customers ask about the menu, prices, or what's available, ALWAYS use the exact item names, Amharic names, prices, and categories from the LIVE MENU below. Never invent items or prices. If an item isn't on the live menu, say it's not currently available.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { message, history, menu } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (Array.isArray(menu) && menu.length > 0) {
      const menuText = menu
        .map((m: any) => `- ${m.nameEn} (${m.nameAm}) — ${m.category} — ETB ${m.price}${m.description ? ` — ${m.description}` : ""}`)
        .join("\n");
      systemPrompt += `\n\nLIVE MENU (current, authoritative):\n${menuText}`;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history ?? []),
      { role: "user", content: message },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, stream: true }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      return new Response(JSON.stringify({ error: text }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});