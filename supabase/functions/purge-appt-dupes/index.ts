// One-off cleanup helper: removes duplicate Salesforce-imported appointment
// rows listed in public._appt_dupes (created during the catch-up sync).
// Deletes in small batches inside a time budget; call repeatedly until done.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const deadline = Date.now() + 100_000;
  let deleted = 0;
  let done = false;
  try {
    while (Date.now() < deadline) {
      const { data, error } = await admin.from("_appt_dupes").select("dup_id").limit(200);
      if (error) throw new Error(error.message);
      const ids = (data || []).map((r: any) => r.dup_id);
      if (!ids.length) { done = true; break; }
      const del = await admin.from("appointments").delete().in("id", ids);
      if (del.error) throw new Error(del.error.message);
      const clean = await admin.from("_appt_dupes").delete().in("dup_id", ids);
      if (clean.error) throw new Error(clean.error.message);
      deleted += ids.length;
    }
    return new Response(JSON.stringify({ ok: true, deleted, done }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, deleted }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
