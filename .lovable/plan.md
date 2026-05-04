# Optimize WhatsApp Webhook Response Time

## Problem

Current `supabase/functions/whatsapp-webhook/index.ts` does all work **before** returning TwiML to Twilio:

1. Insert inbound message into `whatsapp_conversations`
2. Lookup patient by phone
3. Load last 20 conversation messages
4. Call Lovable AI gateway (up to 6 tool-call rounds, each with DB queries)
5. POST reply to Twilio Messages API
6. Insert outbound message
7. Return `<Response/>`

Total: 7–8s. Twilio only needs an empty TwiML ack to mark the webhook successful — replies can be delivered out-of-band via the Twilio REST API (which the function already uses). This is the standard pattern for sub-second Twilio webhook latency.

## Strategy

**Acknowledge first, work later.** Return the empty TwiML response within ~50ms, and run all heavy logic via `EdgeRuntime.waitUntil(...)` so the function instance keeps executing after the HTTP response is flushed. No external queue needed.

Add a fast-path for trivial greetings that skips the AI call entirely (still async-sent so we don't block, but the user sees a reply in ~1s instead of 4–6s).

## Changes (single file: `supabase/functions/whatsapp-webhook/index.ts`)

### 1. Flip the response order

Restructure the `Deno.serve` handler:

```ts
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = performance.now();
  let payload: Record<string, string> = {};
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      form.forEach((v, k) => { payload[k] = String(v); });
    } else if (ct.includes("application/json")) {
      payload = await req.json();
    }
  } catch (_) { /* ignore */ }

  const fromRaw = payload.From || "";
  const userBody = (payload.Body || "").trim();
  const messageSid = payload.MessageSid || payload.SmsMessageSid || "";

  // Schedule all heavy work in the background — does NOT block the response.
  if (fromRaw && userBody) {
    // @ts-ignore - EdgeRuntime is provided by Supabase Edge Runtime
    EdgeRuntime.waitUntil(processMessage({ fromRaw, userBody, messageSid, t0 }));
  }

  console.log(`[whatsapp-webhook] ack in ${(performance.now() - t0).toFixed(0)}ms sid=${messageSid}`);
  return twimlResponse(); // empty <Response/> — Twilio is happy
});
```

`EdgeRuntime.waitUntil` is the Supabase-supported API for background tasks in edge functions; the worker stays alive until the promise resolves (up to the function's wall-clock limit, ~150s — well above our needs).

### 2. Move existing logic into `processMessage(...)`

Lift all current work (Supabase client creation, inbound insert, patient lookup, history fetch, AI tool loop, Twilio reply send, outbound insert) into a single async helper. No semantic changes — just relocated. This preserves the existing API contract and DB writes.

### 3. Fast-path for greetings (skip AI)

Inside `processMessage`, before building the AI prompt:

```ts
const GREETING_RE = /^(hi|hii+|hey+|hello+|helo|yo|hola|namaste|namaskar|good\s*(morning|afternoon|evening)|gm|ge|ga)[\s!.,]*$/i;

if (GREETING_RE.test(userBody)) {
  const firstName = patient?.first_name || "there";
  const reply = `Hi ${firstName}! 👋 I'm DermaCare AI. I can help you book/reschedule/cancel appointments, browse the shop, place orders, or track existing orders. What would you like to do?`;
  const sid = await sendWhatsAppReply(phone, reply);
  await sb.from("whatsapp_conversations").insert({
    patient_id: patient?.id ?? null, phone, direction: "outbound",
    role: "assistant", content: reply, message_sid: sid,
  });
  console.log(`[whatsapp-webhook] greeting fast-path total=${(performance.now() - t0).toFixed(0)}ms`);
  return;
}
```

Greetings now bypass the 1–4s AI round-trip entirely.

### 4. Parallelize independent DB calls

For non-greeting flow, run inbound-insert, patient lookup, and history fetch concurrently with `Promise.all` instead of sequentially. Saves ~200–500ms.

```ts
const [_ins, patient, historyRows] = await Promise.all([
  sb.from("whatsapp_conversations").insert({ phone, direction: "inbound", role: "user", content: userBody, message_sid: messageSid }),
  findPatientByPhone(sb, phone),
  // history fetch is keyed by phone instead of patient_id so it can run in parallel
  sb.from("whatsapp_conversations").select("role, content").eq("phone", phone).in("role", ["user","assistant"]).order("created_at", { ascending: false }).limit(20),
]);
```

(Backfill of `patient_id` on the inbound row stays as best-effort, unchanged.)

### 5. Trim AI tool-loop overhead

Lower `MAX_TOOL_ROUNDS` from 6 → 4 (logs show typical flows finish in 1–2 rounds; 4 is still ample and caps worst-case latency). Keep model `google/gemini-3-flash-preview` (already the fastest in the supported set).

### 6. Performance logging

Add `performance.now()` checkpoints with a consistent prefix so we can grep edge logs:

- `ack` (time to TwiML response)
- `patient_lookup_ms`
- `ai_round_<n>_ms`
- `twilio_send_ms`
- `total_ms`

Format: `[whatsapp-webhook] sid=<MessageSid> stage=<name> ms=<n>`

### 7. No infra/config changes

- No new edge functions, no new tables, no new secrets — all credentials and the Twilio REST send path already exist.
- No `supabase/config.toml` change. `verify_jwt` stays as-is (Twilio is unauthenticated; signature validation is out of scope for this task and would itself add latency — leaving current behavior).
- No caching layer added. The "cache phone→name" suggestion in the brief would require an extra table or Redis service for marginal benefit (patient lookup is a single indexed query, ~30–80ms). Skipping it keeps the change small and risk-free; revisit if logs show the lookup is a real bottleneck.

## Expected results

| Scenario | Before | After |
|---|---|---|
| Twilio webhook ack (all messages) | 7–8s | < 200ms |
| User-perceived greeting reply | 7–8s | ~1s (one Twilio REST hop) |
| User-perceived complex reply (AI + tools) | 7–8s | 3–6s, but webhook itself never blocks |

Twilio retries / timeouts disappear because the webhook always 200s in well under the 15s Twilio limit, and well under the 3s target.

## Risks & mitigations

- **Background task killed early**: `EdgeRuntime.waitUntil` keeps the worker alive; Supabase's edge runtime supports this pattern explicitly. If the platform ever cancels mid-flight, the user just doesn't get a reply for that one message — same failure mode as today's timeout case.
- **Duplicate replies on Twilio retry**: Today, slow responses can already cause Twilio retries. After this change, retries become essentially impossible because we ack instantly. Net improvement.
- **Outbound message ordering**: Unchanged — we still insert outbound rows after `sendWhatsAppReply` resolves.

## Files touched

- `supabase/functions/whatsapp-webhook/index.ts` (refactor only; no new files, no schema changes)
