import { notFound } from "next/navigation";
import Link from "next/link";
import { getCollectionItem } from "@/lib/cms";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getCollectionItem("blog", slug);

  if (!post) notFound();

  return (
    <div className="blog-detail">
      <Link href="/blog" style={{ fontSize: "0.85rem", color: "var(--color-primary)", textDecoration: "none" }}>
        &larr; Back to Blog
      </Link>
      <h1 style={{ marginTop: "1rem" }}>
        {(post.payload.title as string) || "Untitled"}
      </h1>
      {post.payload.date ? (
        <div className="blog-meta">{String(post.payload.date)}</div>
      ) : null}
      <div className="blog-body">
        {String(post.payload.body ?? "")}
      </div>
    </div>
  );
}
