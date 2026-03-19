"use client";

import { useState, useTransition, useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  updateProfile,
  changePassword,
  addAccountAddress,
  deleteAccountAddress,
  setDefaultAccountAddress,
} from "@/app/(portal)/portal/account/actions";
import "@/app/(portal)/portal/account/account.css";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

type Profile = {
  name: string;
  email: string;
  phone: string | null;
  title: string | null;
  companyName: string;
  priceLevelName: string;
};

type Address = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

const TABS = ["Profile", "Password", "Addresses"] as const;

export function AccountClient({
  profile,
  addresses,
}: {
  profile: Profile;
  addresses: Address[];
}) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Profile");

  return (
    <>
      <div className="account-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`account-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Profile" && <ProfileTab profile={profile} />}
      {activeTab === "Password" && <PasswordTab />}
      {activeTab === "Addresses" && <AddressTab addresses={addresses} />}
    </>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(updateProfile, {});

  return (
    <div className="account-section">
      <div className="account-readonly">
        <strong>Company:</strong> {profile.companyName} | <strong>Price Level:</strong> {profile.priceLevelName} | <strong>Email:</strong> {profile.email}
      </div>

      {state.success && <div className="status-message status-success">Profile updated.</div>}

      <form action={formAction} className="account-form">
        <Input label="Name" name="name" required defaultValue={profile.name} error={state.errors?.name} />
        <Input label="Phone" name="phone" defaultValue={profile.phone ?? ""} error={state.errors?.phone} />
        <Input label="Title" name="title" defaultValue={profile.title ?? ""} error={state.errors?.title} placeholder="e.g., Purchasing Manager" />
        <div className="account-form-actions">
          <SubmitButton label="Save Profile" />
        </div>
      </form>
    </div>
  );
}

// ─── Password Tab ────────────────────────────────────────────────────────────

function PasswordTab() {
  const [state, formAction] = useActionState(changePassword, {});

  return (
    <div className="account-section">
      {state.success && <div className="status-message status-success">Password changed successfully.</div>}
      {state.error && <div className="status-message status-error">{state.error}</div>}

      <form action={formAction} className="account-form">
        <Input label="Current Password" name="currentPassword" type="password" required error={state.errors?.currentPassword} />
        <Input label="New Password" name="newPassword" type="password" required error={state.errors?.newPassword} placeholder="12+ characters" />
        <Input label="Confirm New Password" name="confirmPassword" type="password" required error={state.errors?.confirmPassword} />
        <div className="account-form-actions">
          <SubmitButton label="Change Password" />
        </div>
      </form>
    </div>
  );
}

// ─── Address Tab ─────────────────────────────────────────────────────────────

function AddressTab({ addresses }: { addresses: Address[] }) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addAccountAddress(fd);
      if (result.error) setError(result.error);
      else { setShowForm(false); formRef.current?.reset(); }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteAccountAddress(id);
      if (result.error) setError(result.error);
    });
  }

  function handleSetDefault(id: string) {
    startTransition(async () => {
      const result = await setDefaultAccountAddress(id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="account-section">
      <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
        Addresses are shared with all contacts in your company.
      </p>

      {error && <div className="status-message status-error">{error}</div>}

      {addresses.length > 0 ? (
        <div className="account-address-list">
          {addresses.map((a) => (
            <div key={a.id} className={`account-address-card ${a.isDefault ? "is-default" : ""}`}>
              <div className="account-address-label">
                {a.label}
                {a.isDefault && <span className="account-default-badge">Default</span>}
              </div>
              <div className="account-address-body">
                {a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />
                {a.city}, {a.state} {a.postalCode}
                {a.country !== "US" ? ` ${a.country}` : ""}
              </div>
              <div className="account-address-actions">
                {!a.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => handleSetDefault(a.id)} disabled={isPending}>
                    Set Default
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={() => handleDelete(a.id)} disabled={isPending}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--color-text-muted)" }}>No addresses yet.</p>
      )}

      {!showForm && (
        <Button size="sm" onClick={() => setShowForm(true)} style={{ marginTop: "1rem" }}>
          Add Address
        </Button>
      )}

      {showForm && (
        <form ref={formRef} action={handleAdd} className="account-add-form">
          <div className="form-field"><label>Label *</label><input name="label" required placeholder="e.g., Main Office" /></div>
          <div className="form-field"><label>Line 1 *</label><input name="line1" required placeholder="Street address" /></div>
          <div className="form-field"><label>Line 2</label><input name="line2" placeholder="Suite, etc." /></div>
          <div className="form-field"><label>City *</label><input name="city" required /></div>
          <div className="form-field"><label>State *</label><input name="state" required placeholder="ST" /></div>
          <div className="form-field"><label>Zip *</label><input name="postalCode" required /></div>
          <div className="form-field"><label>Country</label><input name="country" defaultValue="US" /></div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <Button type="submit" size="sm" loading={isPending}>Add</Button>
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
