import Link from "next/link";
import { getSiteSettings } from "@/lib/cms";
import "./bom-help.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "BOM Costing Guide" };

/**
 * Self-serve guide for BOM (bill of materials) costing — concepts, a worked
 * example, step-by-step setup with screenshots, and an FAQ. Linked from the
 * BOM admin surfaces. Intentionally visible even while the module is off so
 * an admin can read it before deciding to enable (docs/BOM-COSTING.md §6 —
 * only the working surfaces hide when disabled).
 */
export default async function BomHelpPage() {
  const settings = await getSiteSettings();
  const enabled = settings?.bomCostingEnabled ?? false;

  return (
    <div className="bom-guide">
      <h1>BOM Costing Guide</h1>
      <p className="bom-guide-lede">
        BOM (Bill of Materials) costing prices a product from what it costs to
        build: the materials and labor that go into <strong>one unit</strong>,
        plus a markup. When a material cost or labor rate changes, every product
        that uses it reprices automatically — no spreadsheet, no stale prices.
      </p>

      {!enabled && (
        <div className="bom-guide-banner">
          BOM costing is currently <strong>turned off</strong> for this site.
          Nothing here affects your prices until a Super Admin enables it under{" "}
          <Link href="/admin/settings">Settings → BOM Costing</Link>.
        </div>
      )}

      <nav className="bom-guide-toc">
        <a href="#concepts">Concepts</a>
        <a href="#setup">Setting it up</a>
        <a href="#example">Worked example</a>
        <a href="#variants">Variants</a>
        <a href="#faq">FAQ</a>
      </nav>

      <h2 id="concepts">The five concepts</h2>
      <dl className="bom-guide-dl">
        <dt>Material</dt>
        <dd>
          Anything you consume to build a product — steel by the foot, paint by
          the litre, gaskets by the piece. Each <em>raw</em> material carries
          the <strong>standard cost</strong> you pay for one unit of it.
        </dd>
        <dt>Sub-assembly</dt>
        <dd>
          A part you build yourself out of other materials and labor (a welded
          bracket, a wired panel). You don&apos;t type its cost — it&apos;s
          calculated from its own bill of materials, and it rolls into products
          <em> at cost</em>, with no markup of its own.
        </dd>
        <dt>Labor rate</dt>
        <dd>
          What an hour of a kind of work costs your shop — welder, assembly,
          painter. Cost, not billing rate: profit is added later by the markup.
        </dd>
        <dt>BOM</dt>
        <dd>
          The recipe: which materials (and how much of each) plus which labor
          (and how many hours) go into building <strong>one unit</strong> of a
          product.
        </dd>
        <dt>Markup</dt>
        <dd>
          Your profit, applied once at the finished product —{" "}
          <em>
            material cost × (1 + material markup %) + labor cost × (1 + labor
            markup %) = retail price
          </em>
          . Markup is a percentage <strong>on cost</strong>; the screens also
          show the equivalent gross margin so there&apos;s no confusion between
          the two.
        </dd>
      </dl>

      <h2 id="setup">Setting it up, step by step</h2>
      <ol className="bom-guide-steps">
        <li>
          <h3>1. Turn the module on (Super Admin)</h3>
          <p>
            <strong>Settings → BOM Costing</strong>. The default markups set
            here are used by any product that doesn&apos;t set its own. Nothing
            reprices until a product opts in (step 4).
          </p>
          <img src="/admin-help/bom/settings-toggle.png" alt="The BOM Costing section on the Settings page, with the enable checkbox and default markup fields" />
        </li>
        <li>
          <h3>2. Add your labor rates</h3>
          <p>
            <strong>Catalog → Labor Rates</strong>. One row per kind of work,
            costed per hour.
          </p>
          <img src="/admin-help/bom/labor-rates.png" alt="The Labor Rates page with Welder and Assembly rates" />
        </li>
        <li>
          <h3>3. Add your materials</h3>
          <p>
            <strong>Catalog → Materials</strong>. Raw materials get a unit and
            a unit cost. Build sub-assemblies here too: create a material with
            kind <em>sub-assembly</em>, open it, and give it its own components
            and labor — its cost is computed for you.
          </p>
          <img src="/admin-help/bom/materials-list.png" alt="The Materials page listing raw materials and a sub-assembly with its computed cost" />
          <img src="/admin-help/bom/subassembly.png" alt="A sub-assembly's own BOM editor with component and labor lines" />
        </li>
        <li>
          <h3>4. Turn on BOM pricing for a product</h3>
          <p>
            Open the product and find the <strong>BOM (Bill of Materials)
            Costing</strong> section. Every product starts <em>off</em> — prices
            stay hand-entered until you choose otherwise:
          </p>
          <img src="/admin-help/bom/product-off.png" alt="The BOM section in its default off state with the Turn on BOM pricing button" />
          <p>
            Turn it on, add the component and labor lines for one unit, set the
            markups (or leave them blank to inherit the site defaults), and the
            live breakdown shows exactly how the price is built. The
            variant&apos;s retail price field becomes read-only — the BOM owns
            it now.
          </p>
          <img src="/admin-help/bom/product-bom.png" alt="A product with BOM pricing on: component lines, labor lines, and the live cost breakdown" />
        </li>
      </ol>

      <h2 id="example">Worked example</h2>
      <p>
        A welded <strong>Bracket</strong> sub-assembly uses 4 ft of steel tube
        ($2.50/ft) and 15 minutes of welding ($60/h):
      </p>
      <table className="bom-guide-table">
        <thead>
          <tr><th>Bracket (sub-assembly)</th><th>Qty</th><th>Cost</th><th>Line</th></tr>
        </thead>
        <tbody>
          <tr><td>Steel tube</td><td>4 ft</td><td>$2.50/ft</td><td>$10.00</td></tr>
          <tr><td>Welder</td><td>0.25 h</td><td>$60.00/h</td><td>$15.00</td></tr>
          <tr className="bom-guide-total"><td colSpan={3}>Bracket cost (no markup — it&apos;s a part, not a sale)</td><td>$25.00</td></tr>
        </tbody>
      </table>
      <p>
        A <strong>Gate</strong> product consumes that bracket twice, plus its
        own materials and assembly time, with a 40% material / 80% labor markup:
      </p>
      <table className="bom-guide-table">
        <thead>
          <tr><th>Gate (product)</th><th>Qty</th><th>Cost</th><th>Line</th></tr>
        </thead>
        <tbody>
          <tr><td>Steel tube</td><td>10 ft</td><td>$2.50/ft</td><td>$25.00</td></tr>
          <tr><td>Bracket (sub-assembly)</td><td>2</td><td>$25.00</td><td>$50.00</td></tr>
          <tr><td>Paint</td><td>0.5 L</td><td>$30.00/L</td><td>$15.00</td></tr>
          <tr className="bom-guide-subtotal"><td colSpan={3}>Material cost</td><td>$90.00</td></tr>
          <tr><td>Assembly</td><td>1.5 h</td><td>$40.00/h</td><td>$60.00</td></tr>
          <tr className="bom-guide-subtotal"><td colSpan={3}>Labor cost</td><td>$60.00</td></tr>
          <tr><td colSpan={3}>Material with markup — $90.00 × 1.40</td><td>$126.00</td></tr>
          <tr><td colSpan={3}>Labor with markup — $60.00 × 1.80</td><td>$108.00</td></tr>
          <tr className="bom-guide-total"><td colSpan={3}>Retail price (35.9% gross margin)</td><td>$234.00</td></tr>
        </tbody>
      </table>
      <p>
        If steel goes up to $3.00/ft, the bracket becomes $27.00, the gate&apos;s
        materials become $99.00, and the price moves to <strong>$246.60</strong>{" "}
        — everywhere, automatically, the moment you save the new cost.
      </p>

      <h2 id="variants">Variants: inherit or override</h2>
      <p>
        By default every variant of a product prices from the{" "}
        <strong>product BOM</strong>. Two ways a variant can differ:
      </p>
      <ul className="bom-guide-list">
        <li>
          <strong>Opt out of BOM pricing</strong> — set the variant&apos;s
          “Price from BOM” to <em>Off</em> and its price is hand-entered again,
          even while the rest of the product is computed.
        </li>
        <li>
          <strong>Its own recipe</strong> — give the variant its own component
          lines. The first line you add replaces the inherited components{" "}
          <em>entirely</em> (components and labor override independently);
          deleting its last line goes back to inheriting. The screens warn you
          both ways.
        </li>
      </ul>

      <h2 id="faq">FAQ</h2>
      <dl className="bom-guide-dl">
        <dt>Does enabling this change my prices immediately?</dt>
        <dd>
          Enabling the module alone changes nothing — each product also has to
          have BOM pricing turned on. The moment a product is on (with BOM
          lines), its variants reprice.
        </dd>
        <dt>What happens to orders that were already placed?</dt>
        <dd>
          Nothing, ever. Orders snapshot their prices at the time they&apos;re
          placed; repricing only affects the catalog going forward.
        </dd>
        <dt>What if I turn BOM pricing off again?</dt>
        <dd>
          Prices keep their last computed value and become editable by hand
          again. Your BOM data stays saved for the next time.
        </dd>
        <dt>Why didn&apos;t my variant reprice?</dt>
        <dd>
          A variant with an <em>empty</em> BOM is deliberately never repriced
          (it would be $0). Add component or labor lines and it computes. Also
          check the variant hasn&apos;t individually opted out.
        </dd>
        <dt>A material has no cost — what happens?</dt>
        <dd>
          It contributes $0 and the product shows an “uncosted material”
          warning until you fill the cost in.
        </dd>
        <dt>Can I delete a material that&apos;s used in a BOM?</dt>
        <dd>
          No — deleting is blocked while anything references it. Archive it
          instead: archived materials keep costing normally in existing BOMs
          but disappear from the add-component pickers.
        </dd>
      </dl>
    </div>
  );
}
