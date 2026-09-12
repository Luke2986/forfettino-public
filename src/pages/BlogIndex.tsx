import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import BlogLayout from "@/components/blog/BlogLayout";
import { getAllBlogPosts } from "@/lib/blog-data";

const BLOG_TITLE = "Blog Forfettino: Guide Fiscali per Forfettari | Forfettino";
const BLOG_DESCRIPTION =
  "Guide pratiche e aggiornate su tasse, INPS, scadenze e regime forfettario 2026. Scritte per freelancer italiani.";

export default function BlogIndex() {
  const posts = getAllBlogPosts();

  const collectionPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Blog Forfettino",
    description: BLOG_DESCRIPTION,
    url: "https://forfettino.it/blog",
    publisher: {
      "@type": "Organization",
      name: "Forfettino",
      url: "https://forfettino.it",
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.map((post, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://forfettino.it/blog/${post.slug}`,
        name: post.title,
      })),
    },
  };

  return (
    <BlogLayout>
      <Helmet>
        <title>{BLOG_TITLE}</title>
        <meta name="description" content={BLOG_DESCRIPTION} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href="https://forfettino.it/blog" />
        <link rel="alternate" hrefLang="it-IT" href="https://forfettino.it/blog" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="it_IT" />
        <meta property="og:site_name" content="Forfettino" />
        <meta property="og:title" content={BLOG_TITLE} />
        <meta property="og:description" content={BLOG_DESCRIPTION} />
        <meta property="og:url" content="https://forfettino.it/blog" />
        <meta property="og:image" content="https://forfettino.it/og-image.png?v=2" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Guide fiscali Forfettino per freelancer in regime forfettario" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={BLOG_TITLE} />
        <meta name="twitter:description" content={BLOG_DESCRIPTION} />
        <meta name="twitter:image" content="https://forfettino.it/og-image.png?v=2" />
        <meta name="twitter:image:alt" content="Guide fiscali Forfettino per freelancer in regime forfettario" />
        <script type="application/ld+json">{JSON.stringify(collectionPageSchema)}</script>
      </Helmet>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Blog Forfettino</h1>
        <p className="mt-2 text-sm text-slate-600">
          Guide pratiche per freelancer in regime forfettario
        </p>
      </div>

      <div className="mt-8 grid gap-4">
        {posts.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="group block rounded-2xl border border-slate-200 p-5 sm:p-6 hover:border-teal-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all"
          >
            <h2 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
              {post.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600 line-clamp-2">{post.meta_description}</p>
            <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
              <time dateTime={post.data_aggiornamento}>
                {new Date(post.data_aggiornamento + "T00:00:00").toLocaleDateString("it-IT", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
              <span className="text-teal-600 font-medium group-hover:underline">
                Leggi →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </BlogLayout>
  );
}
