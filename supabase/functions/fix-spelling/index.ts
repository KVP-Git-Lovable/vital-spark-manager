// Spelling only. Nothing else.
//
// The clinic asked for auto-correct on the clinical fields. The browser's own
// spell check underlines a word and offers suggestions on right-click, which is
// one interaction per word - barely quicker than retyping it. This corrects a
// whole field in one press.
//
// Deliberately NOT the elaborate functions beside it: those expand what was
// typed into clinical language, which is a different job and must stay a
// separate, explicit choice. This one changes spelling and nothing else, so it
// is safe to run over notes a doctor has already written.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You correct spelling in a dermatology clinic's clinical notes.

Correct misspelt words and obvious typing slips. That is all you do.

You must NOT:
- rephrase, rewrite, summarise, expand or shorten anything
- add or remove any word, sentence, heading or bullet
- change the order of anything
- translate, or change British to American spelling or back
- change numbers, doses, strengths, units, dates, or times in any way
- change a drug or product name you do not recognise - leave it exactly as typed
- add punctuation or capitals beyond fixing a clear slip

Keep every line break exactly where it is. If a word might be a drug name, a
brand, an abbreviation or a person's name, leave it alone. If nothing is
misspelt, return the text completely unchanged.

Return only the corrected text, with no commentary, quotes or labels.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    const input = typeof text === "string" ? text : "";
    // Nothing to correct: answer without spending a request.
    if (!input.trim()) {
      return new Response(JSON.stringify({ text: input }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        // Deterministic: the same note corrected twice should not come back
        // worded two different ways.
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input },
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
    const corrected = result.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ text: corrected }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fix-spelling error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
