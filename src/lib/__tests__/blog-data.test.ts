import { describe, it, expect } from "vitest";
import { getAllBlogPosts, getBlogPostBySlug, type BlogPost } from "../blog-data";

describe("blog-data", () => {
  describe("getAllBlogPosts", () => {
    it("returns exactly 13 blog posts", () => {
      const posts = getAllBlogPosts();
      expect(posts).toHaveLength(13);
    });

    it("every post has required fields", () => {
      const posts = getAllBlogPosts();
      for (const post of posts) {
        expect(post.slug).toBeTruthy();
        expect(post.title).toBeTruthy();
        expect(post.meta_description).toBeTruthy();
        expect(post.keyword_primaria).toBeTruthy();
        expect(post.keyword_secondarie.length).toBeGreaterThan(0);
        expect(post.schema_markup).toContain("Article");
        expect(post.og_image).toBeTruthy();
        expect(post.cta_target).toBeTruthy();
        expect(post.data_aggiornamento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(post.content.length).toBeGreaterThan(100);
      }
    });

    it("all slugs are unique", () => {
      const posts = getAllBlogPosts();
      const slugs = posts.map((p) => p.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });
  });

  describe("getBlogPostBySlug", () => {
    it("returns the correct post for a valid slug", () => {
      const post = getBlogPostBySlug("calcolo-tasse-regime-forfettario-2026");
      expect(post).toBeDefined();
      expect(post!.title).toContain("Calcolo Tasse");
    });

    it("returns undefined for an invalid slug", () => {
      const post = getBlogPostBySlug("nonexistent-slug");
      expect(post).toBeUndefined();
    });

    it("returns post with FAQPage schema for article 1", () => {
      const post = getBlogPostBySlug("calcolo-tasse-regime-forfettario-2026");
      expect(post!.schema_markup).toContain("FAQPage");
      expect(post!.schema_markup).toContain("HowTo");
    });

    it("returns post with correct cta_target", () => {
      const post = getBlogPostBySlug("scadenze-fiscali-forfettario-2026");
      expect(post!.cta_target).toBe("scadenziario");
    });
  });
});
