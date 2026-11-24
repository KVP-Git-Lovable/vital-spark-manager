CREATE OR REPLACE FUNCTION public.sf_suppression_reason(_object_type text, _sf_id text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dupe boolean := false;
begin
  if _sf_id is null then
    return null;
  end if;
  if _object_type not in ('appointments', 'procedures', 'invoices') then
    return null;
  end if;
  if exists (select 1 from public.sf_deleted_records d
              where d.object_type = _object_type and d.sf_id = _sf_id) then
    return 'deleted_here';
  end if;
  if exists (select 1 from public.trash_items t
              where t.object_type = _object_type and t.status = 'trashed'
                and t.record_data->>'sf_id' = _sf_id) then
    return 'deleted_here';
  end if;
  if _object_type = 'appointments' then
    select exists (select 1 from public.appointments t where t.sf_id = _sf_id) into v_dupe;
  elsif _object_type = 'procedures' then
    select exists (select 1 from public.procedures t where t.sf_id = _sf_id) into v_dupe;
  elsif _object_type = 'invoices' then
    select exists (select 1 from public.invoices t where t.sf_id = _sf_id) into v_dupe;
  end if;
  if v_dupe then
    return 'duplicate_sf_id';
  end if;
  return null;
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.sf_suppression_reason(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sf_suppression_reason(text, text) TO service_role;

DROP POLICY IF EXISTS "anon read category_master" ON public.category_master;
CREATE POLICY "anon read active category_master" ON public.category_master FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "treatment_names_read" ON public.treatment_names;
CREATE POLICY "treatment_names_read" ON public.treatment_names FOR SELECT TO authenticated USING ((SELECT public.is_active_staff()));

DROP POLICY IF EXISTS "Authenticated can view hsn tax master" ON public.hsn_tax_master;
CREATE POLICY "Staff can view hsn tax master" ON public.hsn_tax_master FOR SELECT TO authenticated USING ((SELECT public.is_active_staff()));

DROP POLICY IF EXISTS "Signed-in staff read leave types" ON public.leave_types;
CREATE POLICY "Signed-in staff read leave types" ON public.leave_types FOR SELECT TO authenticated USING ((SELECT public.is_active_staff()));

DROP POLICY IF EXISTS "Everyone signed in reads holidays" ON public.holidays;
CREATE POLICY "Staff read holidays" ON public.holidays FOR SELECT TO authenticated USING ((SELECT public.is_active_staff()));