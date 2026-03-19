import Link from "next/link";
import { getCollection } from "@/lib/cms";
import "@/app/(marketing)/marketing.css";

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
            <h2>{(post.payload.title as string) || "Untitled"}</h2>
            {post.payload.excerpt && (
              <p>{post.payload.excerpt as string}</p>
            )}
          </Link>
        ))
      )}
    </div>
  );
}
