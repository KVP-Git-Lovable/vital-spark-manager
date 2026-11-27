import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { beforeImageUrl, afterImageUrl } = await req.json();

    if (!beforeImageUrl || !afterImageUrl) {
      return new Response(
        JSON.stringify({ error: "Both before and after image URLs are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // The same two-step instruction the nightly runner uses. It was wrong for
    // the clinician's button to be the ungated one: two AIs disagreeing about
    // the same two photos, where the one a doctor actually clicks is the one
    // that will score a face against a forearm.
    //
    // Here the clinician picked the photos by hand, so a refusal is rarer than
    // in the automatic run - but "I picked these" is not evidence they are
    // comparable, and a mis-click should not become a percentage in a record.
    const systemPrompt = `You are a dermatology AI comparing two clinical photographs of the same patient from The Skin Clinic.

STEP 1 - DECIDE WHETHER THE TWO PHOTOS CAN BE COMPARED AT ALL. Refuse the comparison if ANY of these is true:
- they show different body areas (a face and an arm, a scalp and a back)
- they show the same area from views too different to compare (full face vs close-up of one cheek, front vs profile)
- either image is not a clinical skin photograph (a document, a prescription, a report, a screenshot, a product, a room)
- either image is too blurred, too dark or too obstructed to assess
- they do not plausibly show the same person

If you refuse, respond ONLY with:
{"comparable": false, "reason": "<one short sentence saying what the two photos actually show>"}

Do not score a pair you have refused. An improvement percentage across two different body parts is worse than no answer, because it goes into a patient's record.

STEP 2 - ONLY IF the two photos show the same area of the same person in comparable views, respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "comparable": true,
  "overallImprovement": <number 0-100>,
  "summary": "<2-3 sentence summary of changes>",
  "metrics": [
    { "name": "<metric name>", "before": <0-10>, "after": <0-10>, "change": "<improved/worsened/unchanged>" },
    ...
  ],
  "details": "<detailed paragraph about the skin changes observed>",
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"]
}

Analyze these metrics at minimum: Texture, Tone Evenness, Pigmentation, Hydration, Pore Visibility, Fine Lines. Add more if relevant. Scores are 1 (worst) to 10 (best). overallImprovement must never exceed 100.`;

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Please analyze these two skin photos. The first is the BEFORE photo and the second is the AFTER photo." },
                { type: "image_url", image_url: { url: beforeImageUrl } },
                { type: "image_url", image_url: { url: afterImageUrl } },
              ],
            },
          ],
        }),
      });

      if (response.status === 503 && attempt < 2) {
        console.log(`AI gateway returned 503, retrying (attempt ${attempt + 2}/3)...`);
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      break;
    }

    if (!response || !response.ok) {
      const status = response?.status || 500;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = response ? await response.text() : "No response";
      console.error("AI gateway error:", status, errorText);
      throw new Error(`AI model temporarily unavailable. Please try again.`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse JSON from the response, stripping markdown code blocks if present
    let cleanContent = content.trim();
    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const analysis = JSON.parse(cleanContent);

    // A refusal goes back under `error`, which is not a workaround but the one
    // shape that is safe for both builds at once. An edge function changes the
    // moment it is deployed; clinic.quickapp.ai only changes when someone
    // publishes. The published build does
    //   if (data?.error) throw new Error(data.error)
    // so it shows the reason as a toast and prints no figure - exactly right,
    // with no deploy. Returning the refusal any other way would have it render
    // "undefined%" in the live clinic until the next publish.
    if (analysis && analysis.comparable === false) {
      const reason = typeof analysis.reason === "string" && analysis.reason.trim()
        ? analysis.reason.trim()
        : "These two photos do not show the same area, so they cannot be compared.";
      return new Response(
        JSON.stringify({ error: reason, comparable: false, reason }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Skin analysis error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
