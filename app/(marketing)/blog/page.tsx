import { Metadata } from "next";
import Link from "next/link";
import { getCollection } from "@/lib/cms";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog — Farm Tool Insights & Industry News",
  description:
    "Read the latest from Bauman Custom Products: farm tool guides, stable cleaning tips, dealer spotlights, and Canadian agricultural industry news.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog — Farm Tool Insights & Industry News | BCP",
    description:
      "Read the latest from Bauman Custom Products: farm tool guides, stable cleaning tips, dealer spotlights, and Canadian agricultural industry news.",
    url: "/blog",
  },
};

export default async function BlogPage() {
  const posts = await getCollection("blog");

  return (
    <div className="blog-list">
      <h1>Blog</h1>

      {posts.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", marginTop: "1rem" }}>
          No posts yet. Check back soon!
        </p>
      ) : (
        posts.map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`} className="blog-card">
            {post.payload.image ? (
              <img
                src={String(post.payload.image)}
                alt={String(post.payload.title ?? "")}
                className="blog-card-image"
              />
            ) : null}
            <div className="blog-card-body">
              <h2>{String(post.payload.title ?? "Untitled")}</h2>
              {post.payload.date ? (
                <span className="blog-card-date">{String(post.payload.date)}</span>
              ) : null}
              {post.payload.excerpt ? (
                <p>{String(post.payload.excerpt)}</p>
              ) : null}
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
