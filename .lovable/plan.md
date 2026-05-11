Plan:

1. Update Patient profile photo capture flow
   - Keep a hidden camera-only input exactly using `type="file" accept="image/*" capture="environment"`.
   - Make both Patient header Take Photo and Photos tab + Take Photo trigger this same camera input.
   - After a photo is captured, store it temporarily instead of immediately uploading.
   - Open a modal asking “Is this a Before or After photo?” with two actions: Before and After.
   - Upload only after the staff selects the type, saving `photo_type` accordingly.

2. Add photo delete controls
   - Add a trash icon overlay on each photo card, visible on hover and always usable on touch/mobile.
   - Stop the delete click from interfering with photo/card actions.
   - Confirm with `Delete this photo?` before deleting.
   - Remove the storage file and delete the `patient_photos` record, then refresh the photo list.

3. Update Patient profile attachment camera flow
   - Keep the Attachments tab Take Photo input as a camera-only input using `type="file" accept="image/*" capture="environment"`.
   - Ensure Upload File remains a normal file picker and Take Photo never removes or bypasses the capture attribute.
   - After the camera photo is captured, open the existing document type modal with: Prescription, Consent Form, Lab Report, Previous Doctor Report, Other.
   - Save the captured image as an attachment with the selected `document_type`.

4. Add attachment delete controls
   - Add a trash icon to each attachment row/card.
   - Confirm with `Delete this photo?` for image/camera attachments and delete confirmation for attachments.
   - Remove the storage object when possible and delete the `procedure_attachments` record, then refresh attachments.

Technical notes:
- Changes are limited to `src/pages/PatientDetail.tsx`.
- No database schema changes are needed because photo type and attachment document type already exist.
- Existing storage buckets and table queries will be reused.