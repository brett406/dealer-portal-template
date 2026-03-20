"use client";

import { useState, useTransition, useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import type { DealerSettings } from "@/lib/settings";
import {
  updateSiteSettings,
  updateFeatureToggle,
  updateShippingSettings,
  updateAnnouncementBanner,
  updateDefaultTaxRate,
  updateAdminNotificationEmail,
  sendTestEmail,
  createAdminUser,
  updateAdminUser,
  toggleAdminUserActive,
  type FormState,
} from "./actions";
import "./settings.css";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type SiteSettingsData = {
  siteTitle: string;
  siteDescription: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  notificationEmail: string;
  googleAnalyticsId: string;
};

type TaxRateOption = { id: string; label: string; percent: number };

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function SettingsClient({
  currentUserId,
  siteSettings,
  dealerSettings,
  adminUsers,
  taxRates = [],
}: {
  currentUserId: string;
  siteSettings: SiteSettingsData;
  dealerSettings: DealerSettings;
  adminUsers: AdminUser[];
  taxRates?: TaxRateOption[];
}) {
  return (
    <>
      <BusinessInfoSection data={siteSettings} />
      <FeatureTogglesSection settings={dealerSettings} />
      <PricingTaxSection defaultTaxRateId={dealerSettings.defaultTaxRateId} taxRates={taxRates} />
      <AnnouncementBannerSection settings={dealerSettings} />
      <ShippingSection settings={dealerSettings} />
      <EmailSection adminEmail={dealerSettings.adminNotificationEmail} />
      <UserManagementSection users={adminUsers} currentUserId={currentUserId} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: Business Info
// ═══════════════════════════════════════════════════════════════════════════════

function BusinessInfoSection({ data }: { data: SiteSettingsData }) {
  const [state, formAction] = useActionState(updateSiteSettings, {});

  return (
    <div className="settings-section">
      <h2>Business Information</h2>
      {state.success && <div className="status-message status-success">Settings saved.</div>}
      <form action={formAction} className="settings-form">
        <Input label="Site/Business Name" name="siteTitle" required defaultValue={data.siteTitle} />
        <Input label="Description" name="siteDescription" type="textarea" defaultValue={data.siteDescription} />
        <Input label="Contact Email" name="contactEmail" type="email" defaultValue={data.contactEmail} />
        <Input label="Contact Phone" name="contactPhone" defaultValue={data.contactPhone} />
        <Input label="Business Address" name="contactAddress" type="textarea" defaultValue={data.contactAddress} />
        <Input label="Notification Email" name="notificationEmail" type="email" defaultValue={data.notificationEmail} placeholder="For system notifications" />
        <Input label="Google Analytics ID" name="googleAnalyticsId" defaultValue={data.googleAnalyticsId} placeholder="G-XXXXXXXXXX" />
        <div className="settings-form-actions">
          <SubmitButton label="Save" />
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 2: Feature Toggles
// ═══════════════════════════════════════════════════════════════════════════════

function FeatureTogglesSection({ settings }: { settings: DealerSettings }) {
  const [isPending, startTransition] = useTransition();
  const [localSettings, setLocalSettings] = useState(settings);

  function handleToggle(key: keyof DealerSettings, value: boolean) {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    startTransition(async () => {
      await updateFeatureToggle(key, value);
    });
  }

  const toggles: { key: keyof DealerSettings; label: string; desc: string; disabled?: boolean }[] = [
    {
      key: "showProductsToPublic",
      label: "Show Products to Public",
      desc: "Allow non-logged-in visitors to browse the product catalog.",
    },
    {
      key: "showPricesToPublic",
      label: "Show Prices to Public",
      desc: "Display retail prices on the public catalog. If off, visitors see 'Login for pricing'.",
    },
    {
      key: "allowSelfRegistration",
      label: "Allow Self-Registration",
      desc: "Let new companies register for an account through the website.",
    },
    {
      key: "requireApprovalForRegistration",
      label: "Require Approval for Registration",
      desc: "New registrations need admin approval before they can place orders.",
      disabled: !localSettings.allowSelfRegistration,
    },
    {
      key: "requirePONumber",
      label: "Require PO Number",
      desc: "Customers must provide a PO number when placing orders.",
    },
  ];

  return (
    <div className="settings-section">
      <h2>Feature Toggles</h2>
      <div className="settings-toggles">
        {toggles.map((t) => (
          <div key={t.key} className="settings-toggle">
            <label className="settings-toggle-switch">
              <input
                type="checkbox"
                checked={localSettings[t.key] as boolean}
                onChange={(e) => handleToggle(t.key, e.target.checked)}
                disabled={isPending || t.disabled}
              />
              <span className="settings-toggle-slider" />
            </label>
            <div className="settings-toggle-info">
              <div className="settings-toggle-label">{t.label}</div>
              <div className="settings-toggle-desc">{t.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Pricing & Tax
// ═══════════════════════════════════════════════════════════════════════════════

function PricingTaxSection({
  defaultTaxRateId,
  taxRates = [],
}: {
  defaultTaxRateId: string;
  taxRates?: TaxRateOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState(defaultTaxRateId);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateDefaultTaxRate(selected);
      if (result.error) setMessage({ type: "error", text: result.error });
      else setMessage({ type: "success", text: "Default tax rate saved." });
    });
  }

  return (
    <div className="settings-section">
      <h2>Pricing &amp; Tax</h2>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <a
          href="/admin/price-levels"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            textDecoration: "none",
            color: "inherit",
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          Price Levels
          <span style={{ color: "var(--color-text-muted)" }}>&rarr;</span>
        </a>
        <a
          href="/admin/tax-rates"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            textDecoration: "none",
            color: "inherit",
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          Tax Rates
          <span style={{ color: "var(--color-text-muted)" }}>&rarr;</span>
        </a>
      </div>

      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>Default Tax Rate</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
        New companies are automatically assigned this rate. Override per company as needed.
      </p>
      {message && (
        <div className={`status-message ${message.type === "success" ? "status-success" : "status-error"}`}>
          {message.text}
        </div>
      )}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
        <div style={{ flex: 1, maxWidth: "400px" }}>
          <select
            className="form-input"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">None (Tax Exempt)</option>
            {taxRates.map((tr) => (
              <option key={tr.id} value={tr.id}>{tr.label} — {tr.percent}%</option>
            ))}
          </select>
        </div>
        <Button size="sm" onClick={handleSave} loading={isPending}>Save</Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Announcement Banner
// ═══════════════════════════════════════════════════════════════════════════════

function AnnouncementBannerSection({ settings }: { settings: DealerSettings }) {
  const [state, formAction] = useActionState(updateAnnouncementBanner, {});
  const [enabled, setEnabled] = useState(settings.announcementBannerEnabled);
  const [text, setText] = useState(settings.announcementBannerText);
  const [bgColor, setBgColor] = useState(settings.announcementBannerBgColor);
  const [textColor, setTextColor] = useState(settings.announcementBannerTextColor);

  return (
    <div className="settings-section">
      <h2>Announcement Banner</h2>
      {state.success && <div className="status-message status-success">Banner settings saved.</div>}

      <form action={formAction} className="settings-form">
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 500 }}>
            <input
              type="checkbox"
              name="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enable Announcement Banner
          </label>
        </div>

        {enabled && (
          <>
            <div className="form-field" style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "0.25rem", color: "var(--color-text-muted)" }}>
                Banner Text
              </label>
              <input
                name="text"
                className="form-input"
                value={text}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
                placeholder="Free shipping on orders over $500!"
              />
            </div>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "0.25rem", color: "var(--color-text-muted)" }}>
                  Background Color
                </label>
                <input type="color" name="bgColor" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "0.25rem", color: "var(--color-text-muted)" }}>
                  Text Color
                </label>
                <input type="color" name="textColor" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
              </div>
            </div>

            {text && (
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "0.25rem", color: "var(--color-text-muted)" }}>
                  Preview
                </label>
                <div
                  style={{
                    background: bgColor,
                    color: textColor,
                    textAlign: "center",
                    padding: "0.5rem 1rem",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    borderRadius: "4px",
                  }}
                >
                  {text}
                </div>
              </div>
            )}
          </>
        )}

        <div className="settings-form-actions">
          <SubmitButton label="Save Banner" />
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3: Shipping
// ═══════════════════════════════════════════════════════════════════════════════

function ShippingSection({ settings }: { settings: DealerSettings }) {
  const [state, formAction] = useActionState(updateShippingSettings, {});
  const [method, setMethod] = useState(settings.shippingMethod);

  return (
    <div className="settings-section">
      <h2>Shipping</h2>
      {state.success && <div className="status-message status-success">Shipping settings saved.</div>}
      <form action={formAction} className="settings-form">
        <div className="settings-radio-group">
          <label>
            <input type="radio" name="shippingMethod" value="flat" checked={method === "flat"} onChange={() => setMethod("flat")} />
            Flat Rate
          </label>
          {method === "flat" && (
            <div className="settings-conditional-field">
              <label>Flat Rate Amount ($)</label>
              <input name="flatShippingRate" type="number" step="0.01" min="0" defaultValue={settings.flatShippingRate || ""} placeholder="15.00" />
            </div>
          )}

          <label>
            <input type="radio" name="shippingMethod" value="threshold" checked={method === "threshold"} onChange={() => setMethod("threshold")} />
            Free Above Threshold
          </label>
          {method === "threshold" && (
            <div className="settings-conditional-field">
              <label>Flat Rate Amount ($)</label>
              <input name="flatShippingRate" type="number" step="0.01" min="0" defaultValue={settings.flatShippingRate || ""} placeholder="15.00" />
              <label style={{ marginTop: "0.5rem" }}>Free Shipping Threshold ($)</label>
              <input name="freeShippingThreshold" type="number" step="0.01" min="0" defaultValue={settings.freeShippingThreshold ?? ""} placeholder="100.00" />
            </div>
          )}

          <label>
            <input type="radio" name="shippingMethod" value="disabled" checked={method === "disabled"} onChange={() => setMethod("disabled")} />
            No Shipping Charge
          </label>
        </div>

        <div className="settings-form-actions">
          <SubmitButton label="Save Shipping" />
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 4: Email Configuration
// ═══════════════════════════════════════════════════════════════════════════════

function EmailSection({ adminEmail }: { adminEmail: string }) {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState(adminEmail);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSaveEmail() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateAdminNotificationEmail(email);
      if (result.error) setMessage({ type: "error", text: result.error });
      else setMessage({ type: "success", text: "Email saved." });
    });
  }

  function handleTestEmail() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendTestEmail();
      if (result.error) setMessage({ type: "error", text: result.error });
      else setMessage({ type: "success", text: "Test email sent!" });
    });
  }

  return (
    <div className="settings-section">
      <h2>Email Configuration</h2>
      {message && (
        <div className={`status-message ${message.type === "success" ? "status-success" : "status-error"}`}>
          {message.text}
        </div>
      )}
      <div className="settings-email-row">
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "0.25rem", color: "var(--color-text-muted)" }}>
            Admin Notification Email
          </label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
        </div>
        <Button size="sm" onClick={handleSaveEmail} loading={isPending}>Save</Button>
        <Button size="sm" variant="secondary" onClick={handleTestEmail} loading={isPending}>
          Send Test
        </Button>
      </div>
      <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
        Order notifications and registration alerts will be sent to this address.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 5: User Management
// ═══════════════════════════════════════════════════════════════════════════════

function UserManagementSection({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(fd: FormData) {
    setError(null);
    setFormErrors({});
    setTempPassword(null);
    startTransition(async () => {
      const result = await createAdminUser(fd);
      if (result.errors) setFormErrors(result.errors);
      else if (result.error) setError(result.error);
      else {
        setShowForm(false);
        formRef.current?.reset();
        if (result.tempPassword) setTempPassword(result.tempPassword);
      }
    });
  }

  function handleUpdate(fd: FormData) {
    if (!editTarget) return;
    setFormErrors({});
    startTransition(async () => {
      const result = await updateAdminUser(editTarget.id, fd);
      if (result.errors) setFormErrors(result.errors);
      else if (result.error) setError(result.error);
      else setEditTarget(null);
    });
  }

  function handleToggle(u: AdminUser) {
    setError(null);
    startTransition(async () => {
      const result = await toggleAdminUserActive(u.id, currentUserId);
      if (result.error) setError(result.error);
    });
  }

  const columns: TableColumn<AdminUser>[] = [
    {
      key: "name",
      label: "Name",
      render: (row) => (
        <span style={{ opacity: row.active ? 1 : 0.5 }}>
          {row.name}
          {!row.active && <span className="settings-badge-inactive">Inactive</span>}
        </span>
      ),
    },
    { key: "email", label: "Email" },
    {
      key: "role",
      label: "Role",
      render: (row) => <span className="settings-badge-role">{row.role}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="settings-users-actions">
          <Button variant="secondary" size="sm" onClick={() => { setFormErrors({}); setEditTarget(row); }}>
            Edit
          </Button>
          <Button
            variant={row.active ? "danger" : "ghost"}
            size="sm"
            onClick={() => handleToggle(row)}
            disabled={isPending || row.id === currentUserId}
            title={row.id === currentUserId ? "Cannot deactivate yourself" : undefined}
          >
            {row.active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="settings-section">
      <h2>Admin & Staff Users</h2>

      {error && <div className="status-message status-error">{error}</div>}
      {tempPassword && (
        <div className="settings-temp-password">
          Temporary password: <code>{tempPassword}</code> — share securely. Won&apos;t be shown again.
        </div>
      )}

      <Table columns={columns} data={users} emptyMessage="No admin users." />

      {!showForm && !editTarget && (
        <Button size="sm" onClick={() => { setShowForm(true); setFormErrors({}); setTempPassword(null); }} style={{ marginTop: "0.75rem" }}>
          Add User
        </Button>
      )}

      {showForm && (
        <form ref={formRef} action={handleAdd} className="settings-inline-form">
          <div className="form-field">
            <label>Name *</label>
            <input name="name" required placeholder="Full name" />
            {formErrors.name && <p className="form-error-message">{formErrors.name}</p>}
          </div>
          <div className="form-field">
            <label>Email *</label>
            <input name="email" type="email" required placeholder="user@company.com" />
            {formErrors.email && <p className="form-error-message">{formErrors.email}</p>}
          </div>
          <div className="form-field">
            <label>Role *</label>
            <select name="role" required>
              <option value="STAFF">Staff</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          <Button type="submit" size="sm" loading={isPending}>Add</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
        </form>
      )}

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit User">
        {editTarget && (
          <form action={handleUpdate}>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Name</label>
              <input name="name" className="form-input" required defaultValue={editTarget.name} />
              {formErrors.name && <p className="form-error-message">{formErrors.name}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Email</label>
              <input name="email" type="email" className="form-input" required defaultValue={editTarget.email} />
              {formErrors.email && <p className="form-error-message">{formErrors.email}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Role</label>
              <select name="role" className="form-input" defaultValue={editTarget.role}>
                <option value="STAFF">Staff</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" loading={isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
