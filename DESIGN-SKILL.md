# Dealer Portal — Design Skill

> **Purpose:** Token-based design constraints for building clean, professional B2B portal interfaces. Every visual value references CSS custom properties from `theme.config.yaml` so the entire look can be re-skinned per client without touching component code.

---

## When to Apply

Reference these guidelines when:
- Building or modifying any UI in the dealer portal (admin, customer portal, marketing, auth)
- Creating new components or pages
- Reviewing pull requests for visual consistency

---

## 1. Design Principles

1. **Token-first** — Never hard-code a color, font size, or radius. Every visual value comes from a CSS custom property. If a value doesn't have a token, create one.
2. **Data-dense but breathable** — Admin tables and portal catalogs show lots of information. Use compact typography and tight spacing, but give elements enough room to be scannable.
3. **Neutral canvas** — The default theme is clean and professional. No personality in the chrome — personality comes from the client's brand colors and logo via theme tokens.
4. **Consistency over cleverness** — Use the same component patterns everywhere. A button looks the same in admin and portal. A table looks the same whether it shows orders or products.
5. **Progressive disclosure** — Show the essential information first. Details go in detail pages, modals, or expandable sections — not crammed into list views.

---

## 2. Color System

### Rules
- MUST reference CSS custom properties for all colors — never hard-code hex values in components
- MUST maintain text contrast ratio of at least 4.5:1 for accessibility (WCAG AA)
- MUST maintain 3:1 contrast for interactive element boundaries
- SHOULD limit decorative color use — color communicates meaning (status, severity, action type)
- NEVER use color as the only indicator of state — pair with text labels or icons

### Semantic Token Map

All tokens are defined in `theme.config.yaml` and injected as CSS custom properties in the root layout.

| Token | CSS Variable | Usage |
|-------|-------------|-------|
| **Backgrounds** | | |
| Page background | `--color-bg` | Full-page background for all layouts |
| Surface | `--color-surface` | Cards, panels, sidebar, raised containers |
| **Text** | | |
| Primary text | `--color-text` | Headings, body copy, table cell content |
| Muted text | `--color-text-muted` | Secondary labels, timestamps, helper text, placeholders |
| **Borders** | | |
| Default border | `--color-border` | Table borders, input borders, card edges, dividers |
| **Brand** | | |
| Primary | `--color-primary` | Primary buttons, active nav items, links, selected states |
| Primary dark | `--color-primary-dark` | Primary button hover, focused input ring |
| Secondary | `--color-secondary` | Secondary actions, accent badges |
| **Status** | | |
| Success | `--color-success` | Delivered badges, stock-OK indicators, success toasts |
| Warning | `--color-warning` | Low stock, pending approval, processing states |
| Error | `--color-error` | Out of stock, cancelled badges, validation errors, destructive actions |

### Status Badge Colors

Order and approval statuses use a consistent color language across admin and portal:

| Status | Background | Text | Usage |
|--------|-----------|------|-------|
| RECEIVED | `--color-primary` at 10% opacity | `--color-primary` | New order received |
| PROCESSING | `--color-warning` at 10% opacity | `--color-warning` | Order being prepared |
| SHIPPED | `--color-success` at 10% opacity | `--color-success` | Order in transit |
| DELIVERED | `--color-text-muted` at 10% opacity | `--color-text-muted` | Order complete |
| CANCELLED | `--color-error` at 10% opacity | `--color-error` | Order cancelled |
| PENDING | `--color-warning` at 10% opacity | `--color-warning` | Company awaiting approval |
| APPROVED | `--color-success` at 10% opacity | `--color-success` | Company approved |
| REJECTED | `--color-error` at 10% opacity | `--color-error` | Company rejected |

Implementation: badges use the status color at 10% opacity for background and full color for text. This creates a soft, readable indicator that works across any brand palette.

```css
.badge-received {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
}
```

---

## 3. Typography

### Rules
- MUST use the font family from `--font-family` for all text
- MUST use the heading font from `--heading-font-family` for headings (defaults to same as body)
- MUST use `text-balance` on headings and `text-pretty` on body text
- MUST use `tabular-nums` for all numeric data (prices, quantities, order numbers, dates)
- NEVER modify letter-spacing unless explicitly requested
- SHOULD use a single font family across the entire application for consistency

### Type Scale

The portal is data-dense. The type scale is compact, optimized for readability in tables, forms, and list views — not marketing pages.

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `heading-page` | 24px | 700 | 1.2 | Page titles ("Products", "Order #ORD-2026-0042") |
| `heading-section` | 18px | 600 | 1.3 | Section headings, card titles, tab labels |
| `heading-card` | 16px | 600 | 1.4 | Card headers, table group labels, sidebar nav headings |
| `body` | 14px | 400 | 1.5 | Primary body text, table cells, form labels, descriptions |
| `body-medium` | 14px | 500 | 1.5 | Emphasized body text, selected nav items, active filters |
| `body-small` | 13px | 400 | 1.5 | Secondary info, helper text, badge labels, timestamps |
| `caption` | 12px | 400 | 1.4 | Fine print, field hints, table footers, metadata |
| `label` | 12px | 500 | 1.0 | Form field labels, column headers, button text (small) |
| `overline` | 11px | 600 | 1.0 | Uppercase section dividers, status labels (use sparingly) |

### Context-Specific Sizing

| Context | Body Size | Heading Size | Rationale |
|---------|-----------|-------------|-----------|
| Admin tables | 13-14px | 16-18px | Dense data, many columns |
| Admin forms | 14px | 18px | Comfortable reading during data entry |
| Customer portal catalog | 14-15px | 18-24px | Browsing, less dense than admin |
| Customer portal cart/orders | 14px | 18px | Matches admin density |
| Marketing pages | 16-18px | 24-36px | More breathing room, less data |
| Auth pages (login, register) | 15px | 24px | Clean and focused |

### Numeric Data
- MUST use `font-variant-numeric: tabular-nums` on all elements displaying prices, quantities, order numbers, dates, and stock counts
- This ensures columns of numbers align vertically in tables

---

## 4. Spacing

### Rules
- MUST use a 4px base grid for all spacing
- NEVER use arbitrary spacing values — use the defined scale
- SHOULD maintain consistent padding within component categories (all cards same padding, all table cells same padding)
- MUST use tighter spacing in data-dense contexts (admin tables) and more generous spacing in browse contexts (catalog)

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `space-0` | 0px | Flush elements |
| `space-1` | 4px | Tight inline spacing, icon-to-text gap, badge padding |
| `space-2` | 8px | Default gap between related elements, table cell padding (horizontal), input padding (horizontal) |
| `space-3` | 12px | Card padding (compact), table cell padding (vertical), form field gap |
| `space-4` | 16px | Card padding (standard), section separator, sidebar padding |
| `space-5` | 20px | Section gap, form section separator |
| `space-6` | 24px | Page section gap, card margin |
| `space-8` | 32px | Major section separator, page top padding |
| `space-10` | 40px | Page-level breathing room |
| `space-12` | 48px | Marketing section separator |

### Component Spacing Defaults

| Component | Padding | Gap (between children) |
|-----------|---------|----------------------|
| Table cell | 8px horizontal, 10px vertical | — |
| Table header cell | 8px horizontal, 10px vertical | — |
| Card (admin) | 16px | 12px |
| Card (marketing) | 24px | 16px |
| Form field (label to input) | — | 4px |
| Form fields (between fields) | — | 16px |
| Button padding | 8px 16px (md), 6px 12px (sm), 12px 24px (lg) | — |
| Sidebar nav item | 8px 12px | — |
| Page content area | 24px 32px | — |
| Modal padding | 24px | 16px |

---

## 5. Borders

### Rules
- MUST use `--color-border` for all default borders
- MUST use 1px border width for subtle separation (table borders, card edges, dividers)
- MUST use 2px border width only for emphasis (focused inputs, active tabs, selected cards)
- NEVER use arbitrary border-radius values — use the scale below
- SHOULD use subtle borders — if you can see the border from across the room, it's too heavy

### Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Badges, small tags, inline elements |
| `radius-md` | 6px | Buttons, inputs, dropdowns, table header corners |
| `radius-lg` | 8px | Cards, modals, popovers, image containers |
| `radius-xl` | 12px | Large cards (marketing), feature sections |
| `radius-full` | 9999px | Avatars, circular buttons, pill badges |

### Default: `--border-radius` from theme.config.yaml (currently 8px) maps to `radius-lg`.

---

## 6. Layout

### Rules
- MUST design for 1440px as the primary breakpoint (most B2B users are on 1080p+ monitors)
- MUST support responsive down to 768px (tablet) and 375px (mobile)
- NEVER use `h-screen` — use `min-h-dvh` for full viewport height
- MUST respect `safe-area-inset` for any fixed/sticky elements
- SHOULD use CSS Grid for page layouts and Flexbox for component internals
- MUST use `--max-width` from theme for content containment on marketing pages

### Responsive Breakpoints

| Name | Width | Context |
|------|-------|---------|
| `mobile` | < 768px | Single column, hamburger nav, stacked cards |
| `tablet` | 768px - 1024px | Two columns possible, sidebar collapses |
| `desktop` | 1024px - 1440px | Full layout, sidebar visible, multi-column tables |
| `wide` | > 1440px | Content max-width constrains, extra whitespace on sides |

### Admin Layout Structure

```
┌──────────────────────────────────────────────────────┐
│ Top Bar (56px) — logo, breadcrumb, user menu, logout │
├────────────┬─────────────────────────────────────────┤
│ Sidebar    │ Main Content                            │
│ (240px)    │ (padding: 24px 32px)                    │
│            │                                         │
│ Nav items  │ Page heading                            │
│ 8px 12px   │ Filters/actions bar                     │
│ padding    │ Content (table, form, cards)             │
│            │                                         │
│ Collapsed: │                                         │
│ 56px       │                                         │
│ (icons)    │                                         │
└────────────┴─────────────────────────────────────────┘
```

### Portal Layout Structure

```
┌──────────────────────────────────────────────────────┐
│ [Act-As Banner — only when admin is impersonating]   │
├──────────────────────────────────────────────────────┤
│ Portal Header (56px) — logo, nav, cart icon, account │
├──────────────────────────────────────────────────────┤
│ Main Content (padding: 24px, max-width: 1200px)     │
│                                                      │
│ Page heading                                         │
│ Content                                              │
└──────────────────────────────────────────────────────┘
```

---

## 7. Components

### Buttons

| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| Primary | `--color-primary` | white | none | Main CTA: "Submit Order", "Save", "Create" |
| Primary hover | `--color-primary-dark` | white | none | |
| Secondary | `--color-surface` | `--color-text` | 1px `--color-border` | Secondary actions: "Cancel", "Back", "Export" |
| Secondary hover | `--color-border` at 50% | `--color-text` | 1px `--color-border` | |
| Danger | `--color-error` at 10% | `--color-error` | 1px `--color-error` at 30% | Destructive: "Delete", "Cancel Order" |
| Danger hover | `--color-error` | white | none | |
| Ghost | transparent | `--color-primary` | none | Tertiary: inline links, "View all", icon buttons |
| Ghost hover | `--color-primary` at 5% | `--color-primary` | none | |

**All buttons:**
- Height: 36px (sm), 40px (md — default), 48px (lg)
- Padding: per spacing scale above
- Border radius: `radius-md` (6px)
- Font: `label` size (12px/500) for sm, `body-medium` (14px/500) for md, 15px/500 for lg
- Disabled: `opacity: 0.5`, `cursor: not-allowed`
- Loading: show spinner, disable click, keep width stable (use `min-width`)

### Inputs

| Property | Value |
|----------|-------|
| Height | 40px (default), 36px (compact/table inline) |
| Padding | 8px 12px |
| Border | 1px `--color-border` |
| Border radius | `radius-md` (6px) |
| Font | `body` (14px/400) |
| Placeholder | `--color-text-muted` |
| Focus ring | 2px `--color-primary` outline, 2px offset |
| Error state | border `--color-error`, error text below in `caption` size |
| Disabled | `opacity: 0.5`, `cursor: not-allowed`, `--color-surface` background |

**Textarea:** same as input, minimum height 80px, resize vertical only.

**Select/Dropdown:** same height and styling as input. Chevron icon on right.

### Cards

| Property | Value |
|----------|-------|
| Background | `--color-surface` (or white if page bg is the surface color) |
| Border | 1px `--color-border` |
| Border radius | `radius-lg` (8px) |
| Padding | 16px (admin), 24px (marketing) |
| Shadow | none (flat design — borders provide separation) |

- SHOULD NOT use box-shadow for card elevation. Borders are enough.
- Cards on a colored background may use white background with border for contrast.

### Tables

| Property | Value |
|----------|-------|
| Header background | `--color-surface` |
| Header text | `--color-text-muted`, `label` size (12px/500), uppercase optional |
| Row border | 1px `--color-border` bottom only |
| Cell padding | 8px horizontal, 10px vertical |
| Cell text | `body` (14px/400) or `body-small` (13px/400) for dense tables |
| Hover row | `--color-surface` (subtle highlight) |
| Selected row | `--color-primary` at 5% background |
| Striped (optional) | alternate rows at `--color-surface` and `--color-bg` |
| Empty state | Centered text, muted color, illustration optional |

- MUST use `tabular-nums` on all numeric columns
- SHOULD right-align numeric columns (prices, quantities, totals)
- SHOULD left-align text columns
- MUST provide a clear empty state when table has no data

### Badges / Tags

- Height: 22px
- Padding: 2px 8px
- Border radius: `radius-sm` (4px)
- Font: `body-small` (13px/400) or `caption` (12px/400)
- Color: use the status badge color system from Section 2

### Modal / Dialog

- Overlay: black at 50% opacity
- Container: white background, `radius-lg` border radius, 24px padding
- Max width: 480px (small), 640px (medium), 800px (large)
- Header: `heading-section` (18px/600), bottom border separator
- Footer: right-aligned buttons, top border separator
- Close: X button in top-right corner
- MUST use AlertDialog (with explicit confirm/cancel) for destructive actions
- MUST trap focus inside modal for accessibility

### Sidebar Navigation

- Width: 240px (expanded), 56px (collapsed, icons only)
- Background: `--color-surface`
- Border-right: 1px `--color-border`
- Nav items: 40px height, 8px 12px padding
- Active item: `--color-primary` at 10% background, `--color-primary` text, `body-medium` weight
- Hover: `--color-surface` darker shade (or border color at 20%)
- Section headings: `overline` size (11px/600), uppercase, `--color-text-muted`

---

## 8. Interactive States

### Focus
- MUST use 2px outline with `--color-primary` for all focusable elements
- MUST use 2px outline-offset
- NEVER remove focus indicators — keyboard navigation must be visible
- Focus ring should be visible on buttons, inputs, links, cards, nav items

### Hover
- Primary buttons: shift to `--color-primary-dark`
- Secondary buttons: darken background subtly
- Table rows: `--color-surface` background
- Links: underline on hover
- Cards (clickable): subtle border color change or shadow
- Nav items: background change

### Active / Pressed
- Buttons: scale down to `transform: scale(0.98)` for tactile feedback
- Duration: instantaneous (no transition on press, transition on release)

### Disabled
- MUST use `opacity: 0.5` on all disabled elements
- MUST use `cursor: not-allowed`
- MUST remove hover effects on disabled elements
- SHOULD add `aria-disabled="true"` alongside the visual treatment

### Loading
- Buttons: replace label with spinner, maintain button width
- Tables: show skeleton rows (gray bars in cell shapes)
- Pages: show structural skeleton matching the page layout
- SHOULD use skeleton loading, NOT spinners, for content areas
- Spinners are for inline actions (button clicks, form submissions)

---

## 9. Accessibility

- MUST maintain 4.5:1 contrast ratio for normal text (WCAG AA)
- MUST maintain 3:1 contrast ratio for large text and interactive boundaries
- MUST add `aria-label` to all icon-only buttons
- MUST ensure all form inputs have associated labels (visible or `aria-label`)
- MUST use semantic HTML elements (`nav`, `main`, `aside`, `header`, `footer`, `section`, `article`)
- MUST support keyboard navigation for all interactive elements
- MUST use `role="alert"` or `aria-live="polite"` for dynamic error messages and toasts
- NEVER block paste in input or textarea elements
- NEVER auto-play audio or video
- SHOULD provide skip-to-content link for keyboard users
- SHOULD respect `prefers-reduced-motion` for all animations
- SHOULD respect `prefers-color-scheme` if dark mode is ever added

---

## 10. Animation

- NEVER add animation unless it serves a clear UX purpose (feedback, orientation, continuity)
- MUST animate only compositor properties (`transform`, `opacity`)
- NEVER animate layout properties (`width`, `height`, `top`, `left`, `margin`, `padding`)
- MUST keep interaction feedback under 200ms (button press, toggle, hover)
- SHOULD use 200-300ms for content transitions (modal open, panel slide, page transition)
- SHOULD use `ease-out` for entrance animations
- SHOULD use `ease-in` for exit animations
- MUST respect `prefers-reduced-motion`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

---

## 11. Performance

- NEVER animate large `blur()` or `backdrop-filter` surfaces
- NEVER apply `will-change` outside an active animation
- NEVER use `useEffect` for anything that can be expressed as render logic
- MUST use Next.js `<Image>` component for all images (product images, logos, avatars)
- MUST lazy-load images below the fold
- MUST define explicit `width` and `height` or `sizes` on all images to prevent layout shift
- SHOULD use `loading="lazy"` on images outside the viewport
- SHOULD debounce search input (300ms) to avoid excessive server requests
- SHOULD use cursor-based pagination, not offset-based, for large data sets

---

## 12. Forms

- MUST show validation errors inline, directly below the field that has the error
- MUST use red (`--color-error`) for error text and error border
- MUST show errors immediately on blur or on submit — not while the user is still typing
- SHOULD disable the submit button while the form is submitting (with loading spinner)
- MUST preserve form data on validation failure (don't clear the form)
- SHOULD group related fields visually (e.g., address fields together, separated from contact fields)
- MUST use `type="email"` for email inputs, `type="tel"` for phone, `inputMode="numeric"` for quantities
- SHOULD use `autocomplete` attributes on common fields (name, email, address)

---

## 13. Empty States & Zero Data

- MUST provide a clear, helpful message when a table/list has no data
- SHOULD include a call-to-action where appropriate ("No products yet. Add your first product.")
- SHOULD use muted text (`--color-text-muted`) and centered layout for empty states
- MAY include a simple illustration or icon, but keep it subtle (no heavy graphics)
- Admin empty states should guide the user toward the next action
- Portal empty states should explain why there's no data and what to do

---

## 14. Toasts & Notifications

- MUST position toasts in the top-right corner, below the top bar
- MUST auto-dismiss success toasts after 4 seconds
- MUST NOT auto-dismiss error toasts — user must dismiss manually
- SHOULD use a subtle slide-in animation (200ms, ease-out)
- Toast structure: icon + message + optional dismiss button
- Colors: success = `--color-success`, error = `--color-error`, info = `--color-primary`, warning = `--color-warning`

---

## 15. The Act-As-Customer Banner

This is the one element with a hard-coded color intent (not from theme) because it must be immediately noticeable regardless of the client's brand palette:

- Background: `#FFF3CD` (warm yellow — universally reads as "warning/attention")
- Text: `#856404` (dark amber)
- Border-bottom: 1px `#FFEAA7`
- Height: 44px
- Position: fixed top, full width, above all other content
- Content: "You are viewing the portal as **[Customer Name]** from **[Company Name]**" + "Exit" button
- The "Exit" button uses the danger button variant
- MUST NOT be dismissible — stays visible the entire time admin is impersonating

---

## Quick Reference: Token → CSS Variable Map

```yaml
# These come from theme.config.yaml and are injected as CSS custom properties

# Colors
--color-primary:      colors.primary
--color-primary-dark: colors.primaryDark
--color-secondary:    colors.secondary
--color-bg:           colors.background
--color-surface:      colors.surface
--color-text:         colors.text
--color-text-muted:   colors.textMuted
--color-border:       colors.border
--color-success:      colors.success
--color-warning:      colors.warning
--color-error:        colors.error

# Typography
--font-family:         typography.fontFamily
--heading-font-family: typography.headingFontFamily
--base-font-size:      typography.baseFontSize

# Layout
--max-width:           layout.maxWidth
--border-radius:       layout.borderRadius
```
