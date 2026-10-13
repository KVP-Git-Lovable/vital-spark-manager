import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DEFAULT_VIEW_COLUMNS, type ListView } from "@/lib/patientFields";
import { ALL_VIEW_ID, buildStandardViews, setStandardColumns } from "@/lib/standardViews";
import { activeViewKey, pickActiveView } from "@/lib/listViews/pickActiveView";
import { readRemembered, writeRemembered } from "@/lib/listViews/rememberedView";


function normalize(row: any): ListView {
  const rawFilters = row.filters;
  const conditions = Array.isArray(rawFilters)
    ? rawFilters
    : Array.isArray(rawFilters?.conditions)
      ? rawFilters.conditions
      : [];
  return {
    id: row.id,
    name: row.name,
    owner_id: row.user_id,
    filters: {
      match: (row.filter_match === "any" ? "any" : "all") as "all" | "any",
      conditions,
    },
    columns: row.display_fields?.length ? row.display_fields : DEFAULT_VIEW_COLUMNS,
    sort_field: row.sort_by ?? "created_at",
    sort_dir: row.sort_direction === "asc" ? "asc" : "desc",
    visibility: (row.visibility ?? "private") as ListView["visibility"],
    shared_user_ids: row.shared_with ?? [],
    // "Pinned by me", filled in from list_view_defaults below - not the
    // list_views column, which sits on a row the whole clinic may share.
    is_default: false,
    charts: Array.isArray(row.charts) ? row.charts : [],
  };
}


export function usePatientListViews(section = "patients", objectLabel = "Patients") {
  // Was one key for the whole machine, so the front desk restored whatever the
  // last person had been looking at - see pickActiveView.ts.
  const storageKeyRef = useRef(activeViewKey(section));

  const [views, setViews] = useState<ListView[]>([]);
  const [standardViews, setStandardViews] = useState<ListView[]>(() => buildStandardViews(section, objectLabel));
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>();
  const [pinnedViewId, setPinnedViewId] = useState<string | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | null>(ALL_VIEW_ID);
  const [initialised, setInitialised] = useState(false);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    setUserId(uid);
    storageKeyRef.current = activeViewKey(section, uid);

    const [viewsResult, pinResult] = await Promise.all([
      supabase.from("list_views").select("*").eq("section", section).order("created_at", { ascending: false }),
      uid
        ? supabase.from("list_view_defaults").select("view_id").eq("section", section).eq("user_id", uid).maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
    ]);

    if (viewsResult.error) {
      toast.error(viewsResult.error.message);
      setLoading(false);
      return { list: [] as ListView[], pinned: null as string | null };
    }
    const list = (viewsResult.data || []).map(normalize);
    const pinned = (pinResult.data as { view_id?: string } | null)?.view_id ?? null;
    setViews(list);
    setPinnedViewId(pinned);
    setLoading(false);
    return { list, pinned };
  }, [section]);

  useEffect(() => {
    load().then(({ list, pinned }) => {
      if (initialised) return;
      const stored = readRemembered(storageKeyRef.current);
      const choice = pickActiveView({ stored, pinned, views: list });
      if (choice.forget) writeRemembered(storageKeyRef.current, null);
      setActiveViewId(choice.id);
      setInitialised(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const selectView = useCallback((id: string | null) => {
    const next = id ?? ALL_VIEW_ID;
    setActiveViewId(next);
    writeRemembered(storageKeyRef.current, next);
  }, []);

  // `is_default` means "pinned by me" - see useModuleListViews.ts.
  const allViews = useMemo(
    () => [...standardViews, ...views].map((v) => ({ ...v, is_default: v.id === pinnedViewId })),
    [standardViews, views, pinnedViewId]
  );

  const activeView = useMemo(
    () => allViews.find((v) => v.id === activeViewId) ?? allViews[0] ?? null,
    [allViews, activeViewId]
  );

  /** Standard views keep locked filters, but their displayed columns are user-configurable. */
  const updateStandardColumns = useCallback(
    (viewId: string, columns: string[]) => {
      setStandardColumns(section, viewId, columns);
      setStandardViews((prev) => prev.map((v) => (v.id === viewId ? { ...v, columns } : v)));
    },
    [section]
  );


  const saveView = useCallback(
    async (payload: Partial<ListView> & { name: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        toast.error("You must be signed in to save a view");
        return;
      }
      const record = {
        name: payload.name,
        section,
        user_id: uid,
        filters: (payload.filters?.conditions ?? []) as any,
        filter_match: payload.filters?.match ?? "all",
        display_fields: payload.columns?.length ? payload.columns : DEFAULT_VIEW_COLUMNS,
        sort_by: payload.sort_field ?? "created_at",
        sort_direction: payload.sort_dir ?? "desc",
        visibility: payload.visibility ?? "private",
        shared_with: payload.visibility === "selected" ? payload.shared_user_ids ?? [] : [],
        is_shared: (payload.visibility ?? "private") !== "private",
        charts: (payload.charts ?? []) as any,
      };


      if (payload.id) {
        const { error } = await supabase
          .from("list_views")
          .update({ ...record, updated_at: new Date().toISOString() })
          .eq("id", payload.id);
        if (error) return toast.error(error.message);
        toast.success("View updated");
        await load();
        selectView(payload.id);
      } else {
        const { data, error } = await supabase
          .from("list_views")
          .insert({ ...record, is_default: false })
          .select("id")
          .single();
        if (error) return toast.error(error.message);
        toast.success("View created");
        await load();
        if (data?.id) selectView(data.id);
      }
    },
    [section, load, selectView]
  );

  const saveCharts = useCallback(
    async (viewId: string, charts: ListView["charts"]) => {
      // Charts live on the view row, so they inherit the view's sharing rules.
      setViews((prev) => prev.map((v) => (v.id === viewId ? { ...v, charts } : v)));
      const { error } = await supabase
        .from("list_views")
        .update({ charts: charts as any, updated_at: new Date().toISOString() })
        .eq("id", viewId);
      if (error) {
        toast.error(error.message);
        await load();
      }
    },
    [load]
  );

  const deleteView = useCallback(
    async (view: ListView) => {
      const { error } = await supabase.from("list_views").delete().eq("id", view.id);
      if (error) return toast.error(error.message);
      toast.success("View deleted");
      selectView(null);
      await load();
    },
    [load, selectView]
  );


  /** Any view this person can see, including a colleague's shared one. */
  const pinDefault = useCallback(
    async (view: ListView) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return toast.error("You must be signed in to pin a view");
      const { error } = await supabase
        .from("list_view_defaults")
        .upsert({ user_id: uid, section, view_id: view.id, updated_at: new Date().toISOString() },
          { onConflict: "user_id,section" });
      if (error) return toast.error(error.message);
      setPinnedViewId(view.id);
      // Switching to the view it just pinned is the caller's job - on
      // Appointments that also moves the quick-date chips. See ViewBar.tsx.
      toast.success(`"${view.name}" pinned as default`);
    },
    [section]
  );

  const unpinDefault = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const { error } = await supabase
      .from("list_view_defaults")
      .delete()
      .eq("user_id", uid)
      .eq("section", section);
    if (error) return toast.error(error.message);
    setPinnedViewId(null);
    toast.success("Default view cleared");
  }, [section]);

  return {
    views,
    allViews,
    standardViews,
    updateStandardColumns,

    loading,
    userId,
    activeView,
    activeViewId,
    pinnedViewId,
    selectView,
    saveView,
    saveCharts,
    deleteView,

    pinDefault,
    unpinDefault,
    reload: load,
  };
}
