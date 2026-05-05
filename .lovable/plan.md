# Fix "Elaborate AI" Prompt in Procedures Module

## Problem
The `elaborate-text` edge function is generating overly complex, irrelevant medical jargon ("localized erythema", "multispectral imaging", "porphyrin levels") that does not match the skin clinic's day-to-day clinical note style.

## Solution
Update the system prompts in `supabase/functions/elaborate-text/index.ts` for all 4 fields to use plain, GP-level medical language, capped at 2 sentences, with strict instructions against jargon and off-topic additions.

## Changes

### 1. Update Edge Function Prompts (`supabase/functions/elaborate-text/index.ts`)

Rewrite all 4 field prompts to the new persona and constraints:

> "You are a skin clinic assistant helping doctors write brief clinical notes. When given a short input, expand it into a simple, clear, 2-sentence clinical note maximum. Use plain medical language that a general practitioner would use. Do NOT use complex medical jargon, research terminology, or add information not implied by the input. Stay strictly relevant to what was typed."

Fields updated:
- **symptoms**
- **diagnosis**
- **procedure_notes**
- **recommendations** (2-3 short lines max)

### 2. Deploy Edge Function

Deploy the updated `elaborate-text` function immediately so the new prompts take effect in both the New Procedure dialog and the Procedure Detail sheet.

## Verification
- Test the Elaborate AI button on Symptoms, Diagnosis, Procedure Notes, and Recommendations.
- Confirm output is brief, plain-language, and relevant — e.g. input "redness, itching, dry patches" should return something like "Patient presents with redness, itching, and dry patches on the skin. Likely indicative of mild eczema or contact dermatitis."
