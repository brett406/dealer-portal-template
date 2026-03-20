"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { submitDealerApplication, type DealerFormState } from "./actions";
import "./dealer-form.css";

const BUSINESS_TYPES = [
  "Farm & Feed Store",
  "Hardware Store",
  "Equine Supply Store",
  "Garden Centre",
  "Landscape Supply",
  "Other",
];

const PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
];

const PRODUCT_CATEGORIES = [
  "Forks",
  "Brooms",
  "Shovels",
  "Scrapers",
  "Wheelbarrows",
  "Carts & Wagons",
  "Replacement Parts",
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Request Dealer Information
    </Button>
  );
}

export function DealerForm() {
  const [state, formAction] = useActionState<DealerFormState, FormData>(submitDealerApplication, {});

  if (state.success) {
    return (
      <div className="dealer-form-success">
        <h3>Thank you for your interest!</h3>
        <p>
          We&apos;ve received your dealer application and our team will review it shortly.
          You can expect to hear from us within 1–2 business days.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="dealer-form">
      {state.error && <div className="dealer-form-error">{state.error}</div>}

      {/* ── Business Information ── */}
      <fieldset className="dealer-fieldset">
        <legend>Business Information</legend>

        <div className="dealer-field">
          <label htmlFor="businessName">Business Name *</label>
          <input id="businessName" name="businessName" required />
          {state.errors?.businessName && <p className="form-error-message">{state.errors.businessName}</p>}
        </div>

        <div className="dealer-field">
          <label htmlFor="contactName">Contact Name *</label>
          <input id="contactName" name="contactName" required />
          {state.errors?.contactName && <p className="form-error-message">{state.errors.contactName}</p>}
        </div>

        <div className="dealer-field">
          <label htmlFor="title">Title / Position</label>
          <input id="title" name="title" />
        </div>

        <div className="dealer-row">
          <div className="dealer-field">
            <label htmlFor="phone">Phone Number *</label>
            <input id="phone" name="phone" type="tel" required />
            {state.errors?.phone && <p className="form-error-message">{state.errors.phone}</p>}
          </div>
          <div className="dealer-field">
            <label htmlFor="email">Email Address *</label>
            <input id="email" name="email" type="email" required />
            {state.errors?.email && <p className="form-error-message">{state.errors.email}</p>}
          </div>
        </div>

        <div className="dealer-field">
          <label htmlFor="website">Website (if applicable)</label>
          <input id="website" name="website" type="url" placeholder="https://" />
        </div>
      </fieldset>

      {/* ── Business Details ── */}
      <fieldset className="dealer-fieldset">
        <legend>Business Details</legend>

        <div className="dealer-field">
          <label htmlFor="businessType">Business Type *</label>
          <select id="businessType" name="businessType" required defaultValue="">
            <option value="" disabled>Select your business type</option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          {state.errors?.businessType && <p className="form-error-message">{state.errors.businessType}</p>}
        </div>

        <div className="dealer-row">
          <div className="dealer-field">
            <label htmlFor="yearsInBusiness">Years in Business</label>
            <input id="yearsInBusiness" name="yearsInBusiness" />
          </div>
          <div className="dealer-field">
            <label htmlFor="province">Province *</label>
            <select id="province" name="province" required defaultValue="">
              <option value="" disabled>Select province</option>
              {PROVINCES.map((prov) => (
                <option key={prov} value={prov}>{prov}</option>
              ))}
            </select>
            {state.errors?.province && <p className="form-error-message">{state.errors.province}</p>}
          </div>
        </div>

        <div className="dealer-field">
          <label>Do you currently carry agricultural or stable tool lines? *</label>
          <div className="dealer-radio-group">
            <label className="dealer-radio">
              <input type="radio" name="carriesAgTools" value="Yes" required />
              <span>Yes</span>
            </label>
            <label className="dealer-radio">
              <input type="radio" name="carriesAgTools" value="No" />
              <span>No</span>
            </label>
          </div>
          {state.errors?.carriesAgTools && <p className="form-error-message">{state.errors.carriesAgTools}</p>}
        </div>
      </fieldset>

      {/* ── Product Interest ── */}
      <fieldset className="dealer-fieldset">
        <legend>Product Interest</legend>

        <div className="dealer-field">
          <label>What product categories are you most interested in?</label>
          <div className="dealer-checkbox-grid">
            {PRODUCT_CATEGORIES.map((cat) => (
              <label key={cat} className="dealer-checkbox">
                <input type="checkbox" name="productInterests" value={cat} />
                <span>{cat}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="dealer-field">
          <label htmlFor="estimatedVolume">Estimated Order Volume (optional)</label>
          <select id="estimatedVolume" name="estimatedVolume" defaultValue="">
            <option value="">Select estimated volume</option>
            <option value="Opening Order">Opening Order</option>
            <option value="Seasonal Orders">Seasonal Orders</option>
            <option value="Ongoing Stock">Ongoing Stock</option>
          </select>
        </div>

        <div className="dealer-field">
          <label htmlFor="additionalNotes">Additional Notes</label>
          <textarea id="additionalNotes" name="additionalNotes" rows={4} placeholder="Tell us anything else about your business or what you're looking for..." />
        </div>
      </fieldset>

      <SubmitButton />
    </form>
  );
}
