import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDateItalianLong } from "@/lib/date-formatting";

interface BlogArticleProps {
  content: string;
  dataAggiornamento?: string;
}

export default function BlogArticle({ content, dataAggiornamento }: BlogArticleProps) {
  const badgeIso = dataAggiornamento ? dataAggiornamento.slice(0, 10) : undefined;
  const badgeText = badgeIso ? formatDateItalianLong(badgeIso) : undefined;

  return (
    <article
      className="prose prose-slate prose-sm sm:prose-base max-w-none
        prose-headings:text-slate-900 prose-headings:font-bold
        prose-h1:text-2xl prose-h1:sm:text-3xl prose-h1:mb-4
        prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
        prose-h3:text-lg prose-h3:mt-6
        prose-p:text-slate-700 prose-p:leading-relaxed
        prose-a:text-teal-700 prose-a:font-medium prose-a:no-underline hover:prose-a:underline
        prose-strong:text-slate-900
        prose-table:text-sm
        prose-th:bg-slate-100 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-slate-800
        prose-td:px-3 prose-td:py-2 prose-td:border-b prose-td:border-slate-100
        prose-li:text-slate-700
        prose-hr:border-slate-200"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <>
              <h1>{children}</h1>
              {badgeIso && badgeText && (
                <p className="text-sm text-slate-600 mt-2 mb-4 not-prose">
                  Ultimo aggiornamento:{" "}
                  <time dateTime={badgeIso}>{badgeText}</time>
                </p>
              )}
            </>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
