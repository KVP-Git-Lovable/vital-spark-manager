## Salesforce → Make.com → Lovable Cloud Integration Reference

This is a **reference document** (no code changes). It lists every endpoint, auth method, payload, and mapping rule Make.com needs to push Salesforce data into your DermaCare backend.

---

### 1. Base URL & Authentication

All operations use Supabase's auto-generated REST API (PostgREST) and Storage API.

```text
Base URL : https://brdrkhgfbbrgdkzdfbpr.supabase.co
REST     : {Base}/rest/v1/{table_name}
Storage  : {Base}/storage/v1/object/{bucket}/{path}
```

**Auth method: Bearer token + apikey header** (both required, both set to the **service-role key**).

```http
apikey: <SUPABASE_SERVICE_ROLE_KEY>
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
Content-Type: application/json
Prefer: return=representation
```

The service-role key bypasses RLS — store it only in Make.com's connection vault, never in client apps.
You already have it in Lovable Cloud secrets as `SUPABASE_SERVICE_ROLE_KEY`.

---

### 2. Patient Mapping Strategy

Every Salesforce record links to a patient. Use **`phone`** as the primary join key (already unique in your data) and optionally store the SF Id in `notes` for traceability.

Lookup pattern in Make:
```http
GET /rest/v1/patients?phone=eq.{{SF_Phone}}&select=id,first_name,last_name
```

If a row is returned → use `id`. If empty → create the patient first (step 3.1).

---

### 3. Endpoints

#### 3.1 Create Patient
```http
POST /rest/v1/patients
```
```json
{
  "first_name": "Asha",
  "last_name":  "Verma",
  "phone":      "+919812345678",
  "email":      "asha@example.com",
  "gender":     "Female",
  "date_of_birth": "1989-04-12",
  "address":    "12 MG Road",
  "city":       "Mumbai",
  "state":      "MH",
  "pincode":    "400001",
  "blood_group":"O+",
  "medical_history":    "Hypothyroid since 2018",
  "current_medications":"Thyronorm 50mcg",
  "allergies":  "Penicillin",
  "notes":      "sf_id=003XYZ000ABC123"
}
```
Returns the inserted row including `id` (UUID) — store it in Make as `patient_id`.

#### 3.2 Add Procedure (and Prescription)
```http
POST /rest/v1/procedures
```
```json
{
  "patient_id":     "{{patient_id}}",
  "service_name":   "Chemical Peel - Glycolic 30%",
  "procedure_date": "2026-04-20",
  "status":         "Completed",
  "notes":          "Tolerated well. Mild erythema post-procedure.",
  "staff_id":       null
}
```
Then push prescriptions for that procedure:
```http
POST /rest/v1/prescriptions
```
```json
{
  "procedure_id": "{{procedure_id}}",
  "medication":   "Tretinoin 0.025% cream",
  "dosage":       "Pea-sized",
  "frequency":    "Once nightly",
  "duration":     "8 weeks",
  "instructions": "Apply 30 min after washing face"
}
```

#### 3.3 Add Invoice (Billing)
```http
POST /rest/v1/invoices
```
```json
{
  "invoice_number": "INV-SF-000123",
  "patient_id":     "{{patient_id}}",
  "patient_name":   "Asha Verma",
  "services":       ["Chemical Peel - Glycolic 30%"],
  "total_amount":   2675,
  "paid_amount":    2675,
  "status":         "Paid",
  "payment_type":   "One-time",
  "payment_mode":   "Card",
  "tax_rate":       18,
  "tax_amount":     408,
  "notes":          "Imported from Salesforce. sf_id=a01XYZ..."
}
```
For recurring/installment invoices, set `payment_type: "Recurring"` and put installment metadata in `notes` (JSON string) — matches existing schema.

#### 3.4 Upload Photos / Attachments — TWO STEPS

**Step A — upload binary to Storage**
```http
POST /storage/v1/object/patient-photos/{{patient_id}}/{{timestamp}}.jpg
Content-Type: image/jpeg
Body: <binary file bytes>
```
Public URL after upload:
```
https://brdrkhgfbbrgdkzdfbpr.supabase.co/storage/v1/object/public/patient-photos/{{patient_id}}/{{timestamp}}.jpg
```

**Step B — register metadata row**
```http
POST /rest/v1/patient_photos
```
```json
{
  "patient_id":     "{{patient_id}}",
  "procedure_id":   "{{procedure_id}}",   // optional
  "appointment_id": null,                  // optional
  "photo_type":     "before",              // before | after
  "photo_url":      "{{public_url_from_step_A}}",
  "notes":          "Forehead, session 1"
}
```

For procedure documents (PDF/scan), use bucket **`procedure-attachments`** and table **`procedure_attachments`** with `file_url` instead of `photo_url`.

Buckets already public in your project: `patient-photos`, `procedure-attachments`, `invoices`, `product-images`, `expense-attachments`, `attendance-photos`.

#### 3.5 Notes / Medical History
There is no separate `patient_notes` table. Notes are stored on the patient itself:
```http
PATCH /rest/v1/patients?id=eq.{{patient_id}}
```
```json
{ "medical_history": "...", "allergies": "...", "current_medications": "...", "notes": "..." }
```
Procedure-specific notes go in `procedures.notes`.

---

### 4. Bulk Insert
PostgREST accepts arrays — send up to 1000 rows per call:
```http
POST /rest/v1/patients
[ { ... }, { ... }, { ... } ]
```

---

### 5. Limits & Constraints
- File size: 50 MB per object (Storage default).
- API rate: ~ 200 req/sec per project; batch via bulk insert to stay well under.
- Max rows per query/insert: 1000.
- All `id` fields are UUIDs auto-generated — never send your own.
- `phone` should be E.164 (`+91XXXXXXXXXX`) for portal/WhatsApp compatibility.

---

### 6. Webhook Support (Make → Lovable)

Edge functions are public HTTPS endpoints — Make can call them directly. Today none are configured as a generic Salesforce intake webhook. The plan proposes adding **one new edge function**:

```text
POST https://brdrkhgfbbrgdkzdfbpr.supabase.co/functions/v1/salesforce-intake
```

It will accept a normalized payload like:
```json
{
  "type": "patient" | "procedure" | "invoice" | "photo" | "note",
  "sf_id": "003XYZ...",
  "data": { ...record fields... },
  "binary_url": "https://.../file.jpg"   // photos only
}
```
…and internally do patient lookup-or-create, then insert into the right table (and download + upload binary for photos). This means Make only configures **one** webhook URL instead of orchestrating five separate flows.

A shared header secret (`X-Make-Token`) will gate the function so only your Make scenario can call it.

---

### 7. Implementation (when you approve)

Switch to build mode and I will:

1. Create edge function `salesforce-intake` with the routing logic above.
2. Add `verify_jwt = false` for it in `supabase/config.toml`.
3. Add a new secret `MAKE_WEBHOOK_TOKEN` (you'll paste the value once).
4. Provide ready-to-paste Make.com HTTP module configs (URL, headers, sample bodies) for both direct PostgREST and the new webhook.

No frontend changes are required — this is purely backend integration.