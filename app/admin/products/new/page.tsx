import { prisma } from "@/lib/prisma";
import { ProductBasicForm } from "../product-basic-form";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  const categories = await prisma.productCategory.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <h1>New Product</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        Create the product first, then add variants, UOMs, and images.
      </p>

      <div className="prod-edit-section">
        <h2>Basic Information</h2>
        <ProductBasicForm
          action={createProduct}
          categories={categories}
          submitLabel="Create Product"
          cancelHref="/admin/products"
        />
      </div>
    </div>
  );
}
