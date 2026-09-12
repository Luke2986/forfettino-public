import { Link } from "react-router-dom";
import { getAllBlogPosts, type BlogPost } from "@/lib/blog-data";

interface BlogRelatedPostsProps {
  currentSlug: string;
}

export default function BlogRelatedPosts({ currentSlug }: BlogRelatedPostsProps) {
  const related = getAllBlogPosts().filter((p) => p.slug !== currentSlug);

  if (related.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-slate-200">
      <h2 className="text-lg font-bold text-slate-900 mb-4">Leggi anche</h2>
      <div className="grid gap-3">
        {related.map((post: BlogPost) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="group block rounded-xl border border-slate-200 p-4 hover:border-teal-300 hover:bg-teal-50/30 transition-colors"
          >
            <h3 className="text-sm font-semibold text-slate-800 group-hover:text-teal-700 transition-colors">
              {post.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600 line-clamp-2">{post.meta_description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
