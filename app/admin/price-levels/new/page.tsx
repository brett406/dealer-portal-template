import { createPriceLevel } from "../actions";
import { PriceLevelForm } from "../price-level-form";

export const dynamic = "force-dynamic";

export default function NewPriceLevelPage() {
  return (
    <div>
      <h1>New Price Level</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        Create a new discount tier for companies.
      </p>
      <PriceLevelForm action={createPriceLevel} submitLabel="Create Price Level" />
    </div>
  );
}
