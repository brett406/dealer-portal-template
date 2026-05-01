import { requireAdmin } from "@/lib/auth-guards";
import { LocatorDealerForm } from "../locator-dealer-form";
import { createLocatorDealer } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewLocatorDealerPage() {
  await requireAdmin();

  return (
    <div>
      <h1>New Locator Dealer</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
        Add a public-facing dealer to the store locator.
      </p>
      <LocatorDealerForm
        action={createLocatorDealer}
        defaults={{ active: true, country: "CA" }}
        submitLabel="Create Dealer"
      />
    </div>
  );
}
