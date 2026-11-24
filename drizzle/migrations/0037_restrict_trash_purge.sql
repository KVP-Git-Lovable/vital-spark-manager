CREATE OR REPLACE FUNCTION public.purge_trash_item(_trash_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  item public.trash_items;
  days integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'Only active clinic staff can permanently delete'; END IF;

  SELECT * INTO item FROM public.trash_items WHERE id = _trash_id;
  IF NOT FOUND OR item.status <> 'trashed' THEN
    RAISE EXCEPTION 'Trash item not available for deletion';
  END IF;
  IF NOT public.can_restore_trash_item(_trash_id) THEN
    RAISE EXCEPTION 'You are not allowed to permanently delete this item';
  END IF;

  SELECT retention_days INTO days FROM public.trash_settings WHERE id;
  days := COALESCE(days, 30);

  IF item.deleted_at > now() - make_interval(days => days) THEN
    RAISE EXCEPTION 'This item can only be permanently deleted after % day(s) in trash (available on %)',
      days, to_char((item.deleted_at + make_interval(days => days)) AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY');
  END IF;

  IF item.object_type = 'knowledge_articles' THEN
    IF NOT public.can_manage_knowledge() THEN RAISE EXCEPTION 'Only doctors and admins can purge knowledge articles'; END IF;
    DELETE FROM public.knowledge_article_votes WHERE article_id=item.record_id;
    DELETE FROM public.knowledge_article_comments WHERE article_id=item.record_id;
    DELETE FROM public.knowledge_article_opens WHERE article_id=item.record_id;
    DELETE FROM public.knowledge_article_revisions WHERE article_id=item.record_id;
    DELETE FROM public.knowledge_articles WHERE id=item.record_id AND deleted_at IS NOT NULL;
  END IF;
  UPDATE public.trash_items
     SET status = 'purged', purged_at = now(), purged_by = auth.uid(), record_data = '{}'::jsonb
   WHERE id = _trash_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.purge_trash_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_trash_item(uuid) TO authenticated, service_role;