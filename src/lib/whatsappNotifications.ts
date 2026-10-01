/**
 * Which WhatsApp messages the clinic is sending about appointments.
 *
 * Turned off on 1 October 2026, at the clinic's request: patients were being
 * messaged when an appointment was booked as Confirmed and again when the front
 * desk set an existing appointment to Confirmed.
 *
 * Only the confirmation side is off. A cancellation still reaches the patient,
 * because somebody who has been told not to come needs to know.
 *
 * To switch confirmations back on, set this to true - it is the only thing that
 * has to change, and every send site reads it. Nothing else was removed, so the
 * templates, the edge functions and the quick-reply buttons are all still there.
 */
export const APPOINTMENT_CONFIRMATION_WHATSAPP_ENABLED = false;
