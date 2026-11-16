import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, BookOpen, Copy, Pencil, Printer, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useKnowledgeCategories } from "@/hooks/useKnowledge";
import { targetLabel, type KnowledgeArticle } from "@/lib/knowledge";
import { ArticleContent } from "@/components/knowledge/ArticleContent";
import { ArticleEditor } from "@/components/knowledge/ArticleEditor";
import { ArticleEngagement } from "@/components/knowledge/ArticleEngagement";
import { ArticleHistory } from "@/components/knowledge/ArticleHistory";
import { PatientSummary } from "@/components/knowledge/PatientSummary";
import { hasPatientSummary, patientSummaryIsPublic } from "@/lib/patientSummary";
import { printPatientHandout } from "@/lib/patientHandout";
import { reserveTab } from "@/lib/newTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DeleteConfirmDialog from "@/components/shared/DeleteConfirmDialog";
import { toast } from "sonner";

/**
 * A knowledge article on its own page.
 *
 * It used to open in a right-hand drawer capped at sm:max-w-2xl, which is a
 * hard place to read an article that averages 12,500 characters across five
 * clinical sections. Same shape as every other record in this app -
 * /patients/:id, /appointments/:id - so there is nothing new to learn.
 *
 * The drawer was handed the whole article object out of the list's state, so
 * it never needed to fetch. A page can be opened cold from a bookmark or a
 * link in a service, so it owns the query - lifted from the `?article=`
 * handler the list used to run, `.is("deleted_at", null)` included, so a
 * trashed article 404s here rather than rendering.
 */
export default function KnowledgeArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, staffProfile } = useAuth();
  const canEdit = isAdmin || staffProfile?.roleName?.toLowerCase() === "doctor";
  const { data: categories = [] } = useKnowledgeCategories();

  const [editor, setEditor] = useState<KnowledgeArticle | "new" | null>(null);
  const [cloning, setCloning] = useState<KnowledgeArticle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: article, isLoading, error, refetch } = useQuery({
    queryKey: ["knowledge", "article", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_articles")
        .select("*")
        .eq("id", id || "")
        .is("deleted_at", null)
        .single();
      if (error) throw error;
      return data;
    },
  });

  /**
   * Who sees the patient tab.
   *
   * An editor sees it whenever there is anything in it, published or not,
   * because they are the one writing it. Everybody else only once the article
   * is published and active - patientSummaryIsPublic is the single rule the
   * whole feature rests on, and the printed handout asks it again for itself.
   */
  const showPatient = !!article && (canEdit ? hasPatientSummary(article) : patientSummaryIsPublic(article));
  const canPrintHandout = !!article && patientSummaryIsPublic(article);

  const back = () => navigate("/knowledge");

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Button variant="ghost" size="sm" className="gap-2" onClick={back}>
        <ArrowLeft className="h-4 w-4" /> Back to Knowledge Articles
      </Button>

      {error ? (
        <div className="py-16 text-center space-y-3">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-destructive">{error.message}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
            <Button variant="ghost" onClick={back}>Back to Knowledge Articles</Button>
          </div>
        </div>
      ) : isLoading ? (
        <p className="py-16 text-center text-muted-foreground">Loading article…</p>
      ) : !article ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-muted-foreground">This article is no longer available.</p>
          <Button variant="outline" onClick={back}>Back to Knowledge Articles</Button>
        </div>
      ) : (
        // Capped width on purpose: full-bleed prose on a wide monitor gives
        // lines too long to track back from, which is the thing we are
        // trying to fix, not swap for a different version of.
        <article className="max-w-4xl space-y-5">
          <header className="space-y-3">
            <h1 className="text-2xl font-semibold flex items-start gap-2">
              {article.is_critical && <AlertTriangle className="h-5 w-5 mt-1 shrink-0 text-destructive" />}
              {article.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {categories.find((c) => c.id === article.category_id)?.name} · {targetLabel(article)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={article.status === "published" ? "default" : "secondary"}>{article.status}</Badge>
              {!article.is_active && <Badge variant="outline">Inactive</Badge>}
              {article.ai_generated && <Badge variant="outline">AI-assisted</Badge>}
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditor(article)}>
                  <Pencil className="h-4 w-4 mr-2" />Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setCloning(article); setEditor("new"); }}>
                  <Copy className="h-4 w-4 mr-2" />Clone
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDeleting(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </Button>
              </div>
            )}
          </header>

          {/* Two audiences, one article. The patient tab appears for an editor
              whenever there is something in it, so they can see what they are
              writing; for everybody else only once the article is published and
              active, which is the same gate the clinical text already passes.
              collapsible: the long clinical sections start folded behind "Read
              more" - only here, because the editor diff and revision history
              still show every word to a clinician checking wording. */}
          {showPatient ? (
            <Tabs defaultValue="clinical">
              <TabsList>
                <TabsTrigger value="clinical">Clinical</TabsTrigger>
                <TabsTrigger value="patient" data-testid="patient-tab">For the patient</TabsTrigger>
              </TabsList>
              <TabsContent value="clinical" className="pt-4">
                <ArticleContent article={article} collapsible />
              </TabsContent>
              <TabsContent value="patient" className="pt-4 space-y-4">
                {canPrintHandout && (
                  <Button size="sm" variant="outline" onClick={() => {
                    // reserveTab FIRST, inside the click, or the browser treats
                    // the window.open as an unsolicited pop-up. See newTab.ts.
                    const tab = reserveTab();
                    try {
                      printPatientHandout(article, { serviceName: article.title }, tab);
                    } catch (e) { toast.error((e as Error).message); }
                  }}>
                    <Printer className="h-4 w-4 mr-2" />Print handout
                  </Button>
                )}
                <PatientSummary article={article} />
              </TabsContent>
            </Tabs>
          ) : (
            <ArticleContent article={article} collapsible />
          )}
          <ArticleEngagement key={article.id} articleId={article.id} />
          {canEdit && <ArticleHistory article={article} />}
        </article>
      )}

      {canEdit && editor && (
        <ArticleEditor
          article={editor === "new" ? undefined : editor}
          cloneFrom={cloning || undefined}
          onClose={() => {
            setEditor(null);
            setCloning(null);
            void qc.invalidateQueries({ queryKey: ["knowledge"] });
          }}
        />
      )}

      <DeleteConfirmDialog
        open={deleting}
        onOpenChange={(open) => { if (!open) setDeleting(false); }}
        entity="knowledge article"
        onConfirm={async () => {
          if (!article) return;
          const { error } = await supabase.rpc("trash_knowledge_article", { _id: article.id });
          if (error) { toast.error(error.message); throw error; }
          await qc.invalidateQueries({ queryKey: ["knowledge"] });
          toast.success("Article moved to Trash");
          // The record this page is about no longer exists, so staying here
          // would leave a dead page. The drawer could just close; a page has
          // to go somewhere.
          back();
        }}
      />
    </div>
  );
}
