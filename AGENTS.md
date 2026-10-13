# Project Architecture Rules

- Apply app-wide visual polish through shared UI primitives and semantic CSS tokens so page layouts and workflows remain unchanged.
- Use restrained frosted-glass surfaces and transform/opacity-only motion, with reduced-motion fallbacks, to keep the dense clinic UI fast.
- Allow overlapping appointments for the same doctor; clinic workflows require flexible double-booking and must not be blocked.
- Keep WhatsApp conversations on the existing delivery page: replies are sent through the whatsapp-send-reply function and recorded in whatsapp_conversations, and thread history is fetched only for the selected phone to avoid bulk-loading message history.
- Keep a pinned list view personal: it is a row per user in list_view_defaults, any view that user can see may be pinned, and list_views.is_default is historical and must not be read — in the client, is_default means "pinned by me".
