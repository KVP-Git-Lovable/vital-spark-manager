import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { serviceName, fieldType, currentText } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const fieldPrompts: Record<string, string> = {
      symptoms: `You are a dermatologist writing a brief clinical note for service "${serviceName}". Expand the user's input into a concise symptom note. STRICT RULES: maximum 3-4 sentences, stay strictly on topic of what was entered, no generic filler, no textbook background, no unrelated symptoms. If input is very short (3-4 words), expand just enough to make a clear clinical note. Return only the note text, no headers or labels.`,
      diagnosis: `You are a dermatologist writing a brief clinical note for service "${serviceName}". Expand the user's input into a concise diagnosis note. STRICT RULES: maximum 3-4 sentences, stay strictly on topic of what was entered, no generic filler, no textbook background, no differentials unless mentioned. If input is very short (3-4 words), expand just enough to make a clear clinical note. Return only the note text, no headers or labels.`,
      procedure_notes: `You are a dermatologist writing a brief clinical procedure note for service "${serviceName}". Expand the user's input into a concise procedure note. STRICT RULES: maximum 3-4 sentences, stay strictly on topic of what was entered, no generic preparation/aftercare boilerplate, no textbook explanation. If input is very short (3-4 words), expand just enough to make a clear clinical note. Return only the note text, no headers or labels.`,
      recommendations: `You are a dermatologist writing brief post-procedure recommendations for service "${serviceName}". Expand the user's input into concise, actionable recommendations. STRICT RULES: maximum 3-4 short recommendations total, one per line, stay strictly on topic of what was entered, no generic filler. If input is very short (3-4 words), expand just enough to make clear instructions. Return only the recommendations, one per line, no numbering or bullets.`,
    };

    const systemPrompt = fieldPrompts[fieldType] || fieldPrompts.symptoms;

    const userMessage = currentText?.trim()
      ? `Here is the brief text to elaborate:\n\n${currentText}`
      : `Generate appropriate ${fieldType === "recommendations" ? "post-procedure care recommendations" : fieldType.replace("_", " ")} for the service: "${serviceName}"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("elaborate-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
