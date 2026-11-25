-- The prescription and report footers were printing a personal address.
--
-- Both read clinic_settings.email at request time and fall back to the clinic
-- address only when the stored value is empty:
--
--   const email = sanitize(clinic.email) || "theskinclinic30@gmail.com";
--
-- phone and website print correctly because they are blank and the fallback
-- runs. email was the one column with a value in it, so the stored value won
-- and patients were handed documents carrying someone's personal address.
--
-- Corrected in the live database on 25 Nov 2026; this records the same
-- correction so a rebuilt database does not reintroduce it.
--
-- Guarded on the old value: idempotent, and it will not overwrite a later
-- deliberate change to the clinic's address.
update public.clinic_settings
   set email = 'theskinclinic30@gmail.com',
       updated_at = now()
 where id = 'ab600000-0000-0000-0000-000000000001'
   and email = 'suyog.h@kvpcorp.com';
