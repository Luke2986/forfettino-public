import { Helmet } from "react-helmet-async";
import { useParams, Navigate } from "react-router-dom";
import BlogLayout from "@/components/blog/BlogLayout";
import BlogArticle from "@/components/blog/BlogArticle";
import BlogCTA from "@/components/blog/BlogCTA";
import BlogRelatedPosts from "@/components/blog/BlogRelatedPosts";
import { getBlogPostBySlug } from "@/lib/blog-data";
import {
  extractFaqFromMarkdown,
  extractHowToFromMarkdown,
  buildFaqPageSchema,
  buildHowToSchema,
  extractCitationsFromMarkdown,
} from "@/lib/blog-schema";
import {
  AUTHOR_PERSON,
  AUTHOR_PERSON_REF,
  PUBLISHER_ORGANIZATION,
  PUBLISHER_ORGANIZATION_REF,
} from "@/lib/schema-entities";
import { computeWordCount } from "@/lib/blog-wordcount";
import { EmailCaptureForm } from "@/components/marketing/EmailCaptureForm";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPostBySlug(slug) : undefined;

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const canonicalUrl = `https://forfettino.it/blog/${post.slug}`;
  const imageUrl = `https://forfettino.it${post.og_image}`;

  // Keywords: primaria + secondarie (max 10)
  const keywords = [post.keyword_primaria, ...post.keyword_secondarie]
    .filter(Boolean)
    .slice(0, 10);

  // articleSection: prima keyword secondaria oppure fallback
  const articleSection =
    post.keyword_secondarie.length > 0 ? post.keyword_secondarie[0] : "Fisco e Tasse";

  // wordCount deterministico dal contenuto markdown
  const wordCount = computeWordCount(post.content);

  // Citation dalle fonti del markdown (story 79.5) mappate su GEO_SOURCES
  const citation = extractCitationsFromMarkdown(post.content);

  // Article node (sempre presente)
  const articleNode: Record<string, unknown> = {
    "@type": "Article",
    "@id": `${canonicalUrl}#article`,
    headline: post.title,
    description: post.meta_description,
    inLanguage: "it-IT",
    datePublished: post.data_aggiornamento,
    dateModified: post.data_aggiornamento,
    author: AUTHOR_PERSON_REF,
    publisher: PUBLISHER_ORGANIZATION_REF,
    mainEntityOfPage: canonicalUrl,
    image: imageUrl,
    wordCount,
    articleSection,
    keywords,
  };
  if (citation.length > 0) {
    articleNode.citation = citation;
  }

  // BreadcrumbList node (sempre presente)
  const breadcrumbNode = {
    "@type": "BreadcrumbList",
    "@id": `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://forfettino.it" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://forfettino.it/blog" },
      { "@type": "ListItem", position: 3, name: post.title, item: canonicalUrl },
    ],
  };

  // FAQPage node (condizionale)
  let faqNode: Record<string, unknown> | null = null;
  if (post.schema_markup.includes("FAQPage")) {
    const faqs = extractFaqFromMarkdown(post.content);
    if (faqs.length > 0) {
      const built = buildFaqPageSchema(faqs) as Record<string, unknown>;
      faqNode = {
        "@type": "FAQPage",
        "@id": `${canonicalUrl}#faq`,
        mainEntity: built.mainEntity,
      };
    }
  }

  // HowTo node (condizionale)
  let howToNode: Record<string, unknown> | null = null;
  if (post.schema_markup.includes("HowTo")) {
    const data = extractHowToFromMarkdown(post.content);
    if (data) {
      const built = buildHowToSchema(data) as Record<string, unknown>;
      howToNode = {
        "@type": "HowTo",
        "@id": `${canonicalUrl}#howto`,
        name: built.name,
        step: built.step,
      };
    }
  }

  // @graph array — ordine: Article, Breadcrumb, FAQPage?, HowTo?, Person, Organization
  const graph: unknown[] = [articleNode, breadcrumbNode];
  if (faqNode) graph.push(faqNode);
  if (howToNode) graph.push(howToNode);
  graph.push(AUTHOR_PERSON, PUBLISHER_ORGANIZATION);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  return (
    <BlogLayout showBackLink>
      <Helmet>
        <title>{post.title} | Forfettino</title>
        <meta name="description" content={post.meta_description} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" hrefLang="it-IT" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:locale" content="it_IT" />
        <meta property="og:site_name" content="Forfettino" />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.meta_description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={post.title} />
        <meta property="article:published_time" content={post.data_aggiornamento} />
        <meta property="article:modified_time" content={post.data_aggiornamento} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.meta_description} />
        <meta name="twitter:image" content={imageUrl} />
        <meta name="twitter:image:alt" content={post.title} />

        {/* JSON-LD @graph (story 79.6) */}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <BlogArticle content={post.content} dataAggiornamento={post.data_aggiornamento} />
      <BlogCTA ctaTarget={post.cta_target} />
      <div className="my-8">
        <EmailCaptureForm
          source="blog"
          sourceDetail={post.slug}
          variant="inline"
          leadMagnet="guida_protezione"
          headline="Ricevi la Guida Protezione Freelancer"
          subtext="Assicurazioni, INPS e pensione integrativa — 14 pagine di contenuto esclusivo."
        />
      </div>
      <BlogRelatedPosts currentSlug={post.slug} />
    </BlogLayout>
  );
}
