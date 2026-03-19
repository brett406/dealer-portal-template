"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  searchProductsForAccessory,
  addAccessory,
  removeAccessory,
} from "./actions";
import "./products.css";

type Accessory = {
  id: string;
  accessoryId: string;
  name: string;
  sku: string;
  imageUrl: string | null;
};

type SearchResult = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
};

export function AccessorySection({
  productId,
  accessories,
}: {
  productId: string;
  accessories: Accessory[];
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Accessory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await searchProductsForAccessory(productId, searchQuery);
      setSearchResults(results);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, productId]);

  function handleAdd(result: SearchResult) {
    setError(null);
    startTransition(async () => {
      const res = await addAccessory(productId, result.id);
      if (res.error) setError(res.error);
      else {
        setSearchQuery("");
        setSearchResults([]);
        setShowSearch(false);
      }
    });
  }

  function handleRemove(acc: Accessory) {
    setError(null);
    startTransition(async () => {
      const res = await removeAccessory(acc.id);
      if (res.error) setError(res.error);
      setDeleteTarget(null);
    });
  }

  return (
    <div className="prod-edit-section">
      <h2>Accessories</h2>

      {error && <div className="status-message status-error">{error}</div>}

      {accessories.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
          {accessories.map((acc) => (
            <div key={acc.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-surface)" }}>
              {acc.imageUrl ? (
                <img src={acc.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", background: "var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "var(--color-text-muted)" }}>IMG</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: "14px" }}>{acc.name}</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>SKU: {acc.sku}</div>
              </div>
              <Button type="button" variant="danger" size="sm" onClick={() => { setError(null); setDeleteTarget(acc); }}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginBottom: "12px" }}>
          No accessories linked yet.
        </p>
      )}

      {!showSearch && (
        <Button size="sm" onClick={() => setShowSearch(true)}>
          Add Accessory
        </Button>
      )}

      {showSearch && (
        <div style={{ position: "relative", maxWidth: "400px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="search"
              aria-label="Search products to link as accessory"
              placeholder="Search by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "14px" }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}>
              Cancel
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderTop: "none", borderRadius: "0 0 var(--radius-md) var(--radius-md)", zIndex: 10, maxHeight: "300px", overflowY: "auto" }}>
              {searchResults.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderBottom: "1px solid var(--color-border)", cursor: "pointer" }}>
                  {r.imageUrl ? (
                    <img src={r.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--color-surface)" }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{r.sku}</div>
                  </div>
                  <Button type="button" size="sm" onClick={() => handleAdd(r)} loading={isPending}>
                    Link
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Accessory">
        <p>Remove <strong>{deleteTarget?.name}</strong> as an accessory?</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={isPending} onClick={() => deleteTarget && handleRemove(deleteTarget)}>Remove</Button>
        </div>
      </Modal>
    </div>
  );
}
