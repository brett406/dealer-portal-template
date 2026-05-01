"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { PublicLocatorDealer } from "@/lib/locator-dealers";
import "leaflet/dist/leaflet.css";
import "./dealer-locator.css";

type Props = {
  dealers: PublicLocatorDealer[];
  filterOptions: {
    regions: string[];
    dealerTypes: string[];
    industries: string[];
  };
  defaultCenter: { lat: number; lng: number };
  defaultZoom: number;
};

const FALLBACK_CENTER = { lat: 56.1304, lng: -106.3468 }; // Geographic centre of Canada
const FALLBACK_ZOOM = 4;

export function DealerLocator({ dealers, filterOptions, defaultCenter, defaultZoom }: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [dealerType, setDealerType] = useState<string | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Initialize Leaflet once on the client
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const center = defaultCenter ?? FALLBACK_CENTER;
      const zoom = defaultZoom ?? FALLBACK_ZOOM;

      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      markerLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [defaultCenter, defaultZoom]);

  // Filter the dealer set
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dealers.filter((d) => {
      if (region && d.region !== region) return false;
      if (dealerType && d.dealerType !== dealerType) return false;
      if (industry && !d.industries.includes(industry)) return false;
      if (q) {
        const hay = [d.name, d.city, d.region, d.postalCode, d.dealerType, ...d.industries]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dealers, search, region, dealerType, industry]);

  // Render markers when the filtered list or map is ready
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapRef.current || !markerLayerRef.current) return;
      const L = (await import("leaflet")).default;
      if (cancelled) return;

      // Default Leaflet markers reference image paths from leaflet/dist/images
      // that webpack/turbopack don't always resolve. Use an inline SVG icon
      // anchored at the bottom-centre.
      const icon = L.divIcon({
        className: "locator-marker",
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 22 14 22s14-12.5 14-22c0-7.73-6.27-14-14-14z" fill="currentColor"/><circle cx="14" cy="14" r="5.5" fill="#fff"/></svg>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        popupAnchor: [0, -32],
      });

      markerLayerRef.current.clearLayers();

      const bounds: [number, number][] = [];
      for (const d of filtered) {
        if (d.latitude === null || d.longitude === null) continue;
        const popupHtml = `
          <div class="locator-popup-name">${escapeHtml(d.name)}</div>
          <div class="locator-popup-meta">
            ${[d.line1, d.line2, [d.city, d.region, d.postalCode].filter(Boolean).join(", ")]
              .filter((v): v is string => Boolean(v))
              .map(escapeHtml)
              .join("<br/>")}
            ${d.phone ? `<br/><a href="tel:${escapeHtml(d.phone)}">${escapeHtml(d.phone)}</a>` : ""}
            ${d.website ? `<br/><a href="${escapeHtml(d.website)}" target="_blank" rel="noopener noreferrer">Website</a>` : ""}
          </div>
        `;

        const marker = L.marker([d.latitude, d.longitude], { icon })
          .bindPopup(popupHtml)
          .on("click", () => setActiveId(d.id));

        marker.addTo(markerLayerRef.current!);
        bounds.push([d.latitude, d.longitude]);
      }

      if (bounds.length > 0) {
        mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filtered]);

  // Pan to active card
  useEffect(() => {
    if (!activeId || !mapRef.current) return;
    const dealer = filtered.find((d) => d.id === activeId);
    if (!dealer || dealer.latitude === null || dealer.longitude === null) return;
    mapRef.current.flyTo([dealer.latitude, dealer.longitude], Math.max(mapRef.current.getZoom(), 11), {
      duration: 0.5,
    });
  }, [activeId, filtered]);

  const visibleNoCoords = filtered.filter((d) => d.latitude === null || d.longitude === null).length;

  return (
    <div className="locator">
      <aside className="locator-sidebar">
        <div className="locator-filters">
          <input
            className="locator-search"
            type="search"
            placeholder="Search by name, city, postal code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {filterOptions.regions.length > 0 && (
            <div>
              <span className="locator-chip-group-label">Region</span>
              <div className="locator-chips">
                <Chip active={region === null} onClick={() => setRegion(null)}>All</Chip>
                {filterOptions.regions.map((r) => (
                  <Chip key={r} active={region === r} onClick={() => setRegion(r)}>{r}</Chip>
                ))}
              </div>
            </div>
          )}

          {filterOptions.dealerTypes.length > 0 && (
            <div>
              <span className="locator-chip-group-label">Dealer Type</span>
              <div className="locator-chips">
                <Chip active={dealerType === null} onClick={() => setDealerType(null)}>All</Chip>
                {filterOptions.dealerTypes.map((t) => (
                  <Chip key={t} active={dealerType === t} onClick={() => setDealerType(t)}>{t}</Chip>
                ))}
              </div>
            </div>
          )}

          {filterOptions.industries.length > 0 && (
            <div>
              <span className="locator-chip-group-label">Industry</span>
              <div className="locator-chips">
                <Chip active={industry === null} onClick={() => setIndustry(null)}>All</Chip>
                {filterOptions.industries.map((i) => (
                  <Chip key={i} active={industry === i} onClick={() => setIndustry(i)}>{i}</Chip>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="locator-result-count">
          {filtered.length} {filtered.length === 1 ? "dealer" : "dealers"}
          {visibleNoCoords > 0 && ` · ${visibleNoCoords} not on map (no coordinates)`}
        </div>

        <div className="locator-list">
          {filtered.length === 0 ? (
            <div className="locator-empty">
              No dealers match those filters.
            </div>
          ) : (
            filtered.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`locator-card ${activeId === d.id ? "locator-card-active" : ""}`}
                onClick={() => setActiveId(d.id)}
              >
                <div className="locator-card-name">{d.name}</div>
                <div className="locator-card-meta">
                  {[d.city, d.region].filter(Boolean).join(", ")}
                  {d.postalCode && ` · ${d.postalCode}`}
                  {d.phone && <><br />{d.phone}</>}
                </div>
                {(d.dealerType || d.industries.length > 0) && (
                  <div className="locator-card-tags">
                    {d.dealerType && <span className="locator-card-tag">{d.dealerType}</span>}
                    {d.industries.map((ind) => (
                      <span key={ind} className="locator-card-tag">{ind}</span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="locator-map" ref={containerRef} />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`locator-chip ${active ? "locator-chip-active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
