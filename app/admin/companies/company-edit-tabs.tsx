"use client";

import { useState } from "react";
import { CompanyInfoForm } from "./company-info-form";
import { ContactSection } from "./contact-section";
import { AddressSection } from "./address-section";
import { OrderHistorySection } from "./order-history-section";
import { ApprovalBar } from "./approval-bar";
import type { FormState } from "./actions";
import "./companies.css";

type PriceLevel = { id: string; name: string };
type TaxRateOption = { id: string; label: string; percent: number };

type Contact = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  title: string | null;
  active: boolean;
  createdAt: string;
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

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  submittedAt: string;
  customerName: string;
  placedByAdmin: string | null;
};

const TABS = ["Info", "Contacts", "Addresses", "Orders"] as const;

export function CompanyEditTabs({
  companyId,
  companyName,
  approvalStatus,
  formAction,
  priceLevels,
  taxRates,
  defaultValues,
  contacts,
  addresses,
  orders,
  canActAs = false,
}: {
  companyId: string;
  companyName: string;
  approvalStatus: string;
  formAction: (state: FormState, formData: FormData) => Promise<FormState>;
  priceLevels: PriceLevel[];
  taxRates?: TaxRateOption[];
  defaultValues: {
    name?: string;
    priceLevelId?: string;
    taxRateId?: string;
    phone?: string;
    notes?: string;
    active?: boolean;
  };
  contacts: Contact[];
  addresses: Address[];
  orders: OrderRow[];
  canActAs?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Info");

  return (
    <>
      <ApprovalBar companyId={companyId} status={approvalStatus} />

      <div className="co-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`co-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === "Contacts" && ` (${contacts.length})`}
            {tab === "Addresses" && ` (${addresses.length})`}
            {tab === "Orders" && ` (${orders.length})`}
          </button>
        ))}
      </div>

      {activeTab === "Info" && (
        <div className="co-edit-section">
          <h2>Company Information</h2>
          <CompanyInfoForm
            action={formAction}
            priceLevels={priceLevels}
            taxRates={taxRates}
            defaultValues={defaultValues}
            submitLabel="Save Changes"
            cancelHref="/admin/companies"
          />
        </div>
      )}

      {activeTab === "Contacts" && (
        <ContactSection
          companyId={companyId}
          contacts={contacts}
          canActAs={canActAs}
          companyApproved={approvalStatus === "APPROVED"}
        />
      )}

      {activeTab === "Addresses" && (
        <AddressSection companyId={companyId} addresses={addresses} />
      )}

      {activeTab === "Orders" && (
        <OrderHistorySection orders={orders} />
      )}
    </>
  );
}
