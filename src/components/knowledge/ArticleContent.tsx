import { clinicalFields, type KnowledgeArticle } from "@/lib/knowledge";

export function ArticleContent({ article }: { article: Pick<KnowledgeArticle, "summary" | "clinical_protocol" | "contraindications" | "pre_post_care" | "complications_management" | "sources"> }) {
  return <div className="space-y-5 text-sm break-words">
    {article.summary && <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{article.summary}</p>}
    {clinicalFields.map(([key, label]) => article[key] ? <section key={key} className="space-y-2"><h3 className="font-semibold">{label}</h3><div className="whitespace-pre-wrap leading-relaxed">{article[key]}</div></section> : null)}
  </div>;
}