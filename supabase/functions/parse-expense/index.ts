import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expense receipt/invoice parser. Extract expense details from the uploaded image and return ONLY valid JSON with these fields:
{
  "title": "Brief description of the expense",
  "amount": number (total amount),
  "expense_date": "YYYY-MM-DD format",
  "vendor_name": "Name of the vendor/merchant",
  "reference_number": "Invoice/receipt number if visible",
  "category_suggestion": "Suggested category like Rent, Utilities, Office Supplies, Medical Supplies, Equipment, Travel, Food, Maintenance, Marketing, Insurance, Salaries, Miscellaneous",
  "notes": "Any other relevant details",
  "payment_mode": "Cash/Card/UPI/Bank Transfer/Cheque - if identifiable"
}
If you cannot determine a field, set it to null. Always return valid JSON only, no markdown.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Parse this expense receipt/invoice and extract the details." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Try to parse the JSON from the response
    let parsed;
    try {
      // Remove markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response as JSON:", content);
      parsed = { title: "Expense", amount: 0, notes: content };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-expense error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
