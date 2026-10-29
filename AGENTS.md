# Project Architecture Rules

- Keep service knowledge in dedicated articles with database-enforced active doctor/admin review, immutable revision snapshots, and draft-only AI suggestions; this prevents unreviewed clinical content from appearing in appointments.
- Resolve appointment knowledge dynamically from the booked service and recorded procedure service IDs, with inclusive demographic matching; never persist guessed article assignments or automatically alter prescriptions.
- Keep knowledge AI server-only on the Responses gateway with streamed results and persistent terminal access blocks; suggestions enter articles only through an explicit clinician save.

- Send Google review requests through send-google-review-whatsapp using the configured approved template; reuse staff authentication and caller-scoped patient reads so the clinic sender cannot be used anonymously or bypass record access.

- Apply app-wide visual polish through shared UI primitives and semantic CSS tokens so page layouts and workflows remain unchanged.
- Use restrained frosted-glass surfaces and transform/opacity-only motion, with reduced-motion fallbacks, to keep the dense clinic UI fast.
- Allow overlapping appointments for the same doctor; clinic workflows require flexible double-booking and must not be blocked.
- Keep WhatsApp conversations on the existing delivery page: replies are sent through the whatsapp-send-reply function and recorded in whatsapp_conversations, and thread history is fetched only for the selected phone to avoid bulk-loading message history.
- /whatsapp-log is the canonical WhatsApp inbox and the only place a reply may be sent. The Communications Center also has a conversations view at /communications/whatsapp/conversations: it was ported from the staging clinic for parity and is deliberately read-only, over the same whatsapp_conversations table. Two views of one table is the intended state, not an oversight to tidy up - if they are ever merged, /whatsapp-log is the one that survives, because it owns threads, unread marks, the 24-hour reply window and Twilio delivery sync.
- Keep a pinned list view personal: it is a row per user in list_view_defaults, any view that user can see may be pinned, and list_views.is_default is historical and must not be read — in the client, is_default means "pinned by me".
