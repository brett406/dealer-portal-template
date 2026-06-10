import "./help-tip.css";

/**
 * Small "?" affordance that reveals a short explanation on hover or keyboard
 * focus. Pure CSS (no JS state) so it works inside server and client
 * components alike. Keep `text` to one or two plain-language sentences —
 * anything longer belongs in page copy, not a tooltip.
 */
export function HelpTip({ text }: { text: string }) {
  return (
    <span className="help-tip">
      <span className="help-tip-trigger" tabIndex={0} role="note" aria-label={text}>
        ?
      </span>
      <span className="help-tip-bubble" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
