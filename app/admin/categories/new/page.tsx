import { createCategory } from "../actions";
import { CategoryForm } from "../category-form";

export const dynamic = "force-dynamic";

export default function NewCategoryPage() {
  return (
    <div>
      <h1>New Category</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        Create a new product category.
      </p>
      <CategoryForm action={createCategory} submitLabel="Create Category" />
    </div>
  );
}
