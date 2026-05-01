"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { LocatorDealerFormState } from "./actions";

type Defaults = {
  name?: string;
  slug?: string;
  dealerType?: string;
  industries?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  active?: boolean;
  sortOrder?: number;
  latitude?: number | null;
  longitude?: number | null;
};

export function LocatorDealerForm({
  action,
  defaults,
  submitLabel,
  onDelete,
}: {
  action: (
    prev: LocatorDealerFormState,
    fd: FormData,
  ) => Promise<LocatorDealerFormState>;
  defaults: Defaults;
  submitLabel: string;
  onDelete?: () => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const router = useRouter();
  const errs = state.errors ?? {};

  return (
    <form action={formAction} style={{ maxWidth: "720px" }}>
      {state.success && (
        <div className="status-message status-success" style={{ marginBottom: "1rem" }}>
          Saved.
        </div>
      )}
      {state.error && (
        <div className="status-message status-error" style={{ marginBottom: "1rem" }}>
          {state.error}
        </div>
      )}

      <fieldset style={{ border: "none", padding: 0, margin: "0 0 1.5rem" }}>
        <legend style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Identity</legend>
        <Input
          label="Name"
          name="name"
          defaultValue={defaults.name ?? ""}
          required
          error={errs.name}
        />
        <Input
          label="Slug (auto from name if blank)"
          name="slug"
          defaultValue={defaults.slug ?? ""}
          error={errs.slug}
        />
        <Input
          label="Dealer Type (e.g. Authorized, Distributor)"
          name="dealerType"
          defaultValue={defaults.dealerType ?? ""}
          error={errs.dealerType}
        />
        <Input
          label="Industries (comma-separated, e.g. Agricultural, Industrial)"
          name="industries"
          defaultValue={defaults.industries ?? ""}
          error={errs.industries}
        />
      </fieldset>

      <fieldset style={{ border: "none", padding: 0, margin: "0 0 1.5rem" }}>
        <legend style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Address</legend>
        <Input label="Line 1" name="line1" defaultValue={defaults.line1 ?? ""} />
        <Input label="Line 2" name="line2" defaultValue={defaults.line2 ?? ""} />
        <Input label="City" name="city" defaultValue={defaults.city ?? ""} />
        <Input
          label="Region (Province / State)"
          name="region"
          defaultValue={defaults.region ?? ""}
        />
        <Input
          label="Postal / ZIP"
          name="postalCode"
          defaultValue={defaults.postalCode ?? ""}
        />
        <Input
          label="Country (2-letter, e.g. CA / US)"
          name="country"
          defaultValue={defaults.country ?? "CA"}
        />
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem", fontSize: "0.9rem" }}>
          <input type="checkbox" name="geocode" defaultChecked />
          Look up latitude / longitude from address on save
        </label>
        {defaults.latitude !== null && defaults.latitude !== undefined && (
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
            Currently geocoded to {defaults.latitude}, {defaults.longitude}
          </p>
        )}
      </fieldset>

      <fieldset style={{ border: "none", padding: 0, margin: "0 0 1.5rem" }}>
        <legend style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Contact</legend>
        <Input label="Phone" name="phone" defaultValue={defaults.phone ?? ""} />
        <Input label="Email" name="email" defaultValue={defaults.email ?? ""} />
        <Input label="Website" name="website" defaultValue={defaults.website ?? ""} />
      </fieldset>

      <fieldset style={{ border: "none", padding: 0, margin: "0 0 1.5rem" }}>
        <legend style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Display</legend>
        <Input
          label="Sort Order"
          name="sortOrder"
          type="number"
          defaultValue={String(defaults.sortOrder ?? 0)}
        />
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem", fontWeight: 500 }}>
          <input type="checkbox" name="active" defaultChecked={defaults.active ?? true} />
          Active (show on public locator)
        </label>
        <Input
          label="Notes (admin-only, not shown publicly)"
          name="notes"
          type="textarea"
          defaultValue={defaults.notes ?? ""}
        />
      </fieldset>

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        <Link href="/admin/locator-dealers">
          <Button type="button" variant="secondary">Cancel</Button>
        </Link>
        {onDelete && (
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (confirm("Delete this dealer? This cannot be undone.")) {
                onDelete();
              }
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
