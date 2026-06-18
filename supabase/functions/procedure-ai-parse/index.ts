import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const {
      transcript,
      currentFields = {},
      patients = [],
      doctors = [],
      assistants = [],
      problemAreas = [],
    } = await req.json();
    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ error: "transcript required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fmt = (list: any[]) =>
      (list || []).slice(0, 800).map((x) => `${x.id}|${x.name}`).join("\n") || "(none)";

    const system = `You parse a doctor's free-form clinical dictation into structured procedure fields.
Only populate fields the doctor explicitly mentioned. For fields not mentioned, return null.
Do NOT invent clinical content. Keep wording close to the doctor's words; light cleanup only.
If the doctor mentioned medicines, return each as a prescription row.

DROPDOWN MATCHING RULES (very important):
- For patient, doctor, assistant, and problem areas, you MUST map the spoken phrase to the
  closest option in the provided lists using fuzzy / word-overlap matching.
- Tolerate transcription noise: missing/extra honorifics (Dr., nurse), word order, partial
  names, minor spelling variants, plural/singular ("pimples" -> "Acne", "wrinkles" -> "Anti Aging").
- Return the EXACT id from the list when you find a reasonable match (do not invent ids).
- If you are NOT confident in a match, set the id (or omit it from the array) and return the
  raw spoken phrase in the corresponding *_query / *_unmatched field so the UI can show a hint.
- problem_area_ids is an array — include every confident match; put unmatched phrases in
  problem_area_unmatched.

PATIENTS (id|name):\n${fmt(patients)}\n
DOCTORS (id|name):\n${fmt(doctors)}\n
ASSISTANTS (id|name, nurses & support staff):\n${fmt(assistants)}\n
PROBLEM AREAS (id|name):\n${fmt(problemAreas)}`;

    const user = `TRANSCRIPT:\n${transcript}\n\nCURRENT FIELDS (for context, do not duplicate if unchanged):\n${JSON.stringify(currentFields)}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [{
          type: "function",
          function: {
            name: "fill_procedure_fields",
            description: "Fill procedure fields from doctor dictation.",
            parameters: {
              type: "object",
              properties: {
                patient_id: { type: ["string", "null"] },
                patient_query: { type: ["string", "null"] },
                doctor_id: { type: ["string", "null"] },
                doctor_query: { type: ["string", "null"] },
                assistant_id: { type: ["string", "null"] },
                assistant_query: { type: ["string", "null"] },
                problem_area_ids: {
                  type: "array",
                  items: { type: "string" },
                },
                problem_area_unmatched: {
                  type: "array",
                  items: { type: "string" },
                },
                service_name: { type: ["string", "null"] },
                symptoms: { type: ["string", "null"] },
                diagnosis: { type: ["string", "null"] },
                procedure_notes: { type: ["string", "null"] },
                recommendations: { type: ["string", "null"] },
                prescriptions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      medicine_name: { type: "string" },
                      frequency: { type: "string" },
                      duration: { type: "string" },
                      instructions: { type: "string" },
                    },
                    required: ["medicine_name"],
                    additionalProperties: false,
                  },
                },
              },
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "fill_procedure_fields" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: `AI gateway ${resp.status}`, detail: t.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const json = await resp.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(args); } catch { parsed = {}; }
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});