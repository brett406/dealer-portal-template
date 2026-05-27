"use client";

import { forwardRef, useState } from "react";
import "./button.css";
import "./file-input.css";

interface FileInputProps {
  name?: string;
  accept?: string;
  /** Text shown on the styled button (default "Choose file"). */
  buttonLabel?: string;
  /** Show the selected filename / "No file chosen" next to the button. */
  showFileName?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Design-system file picker. Replaces the browser-default "Choose File" control
 * (which ignores the theme) with the standard secondary button + a filename
 * label. The native <input type="file"> is visually hidden but fully
 * accessible — the wrapping <label> makes the whole control activate it, and
 * keyboard focus shows the focus ring on the button.
 *
 * Forwards a ref to the underlying input, so callers can read `.files`
 * (ref-based upload), or pass `onChange` (immediate upload). Use this instead
 * of a raw <input type="file"> everywhere.
 */
export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(function FileInput(
  { name, accept, buttonLabel = "Choose file", showFileName = true, disabled = false, className = "", onChange, ...rest },
  ref,
) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <label className={`ui-file-input ${disabled ? "is-disabled" : ""} ${className}`.trim()}>
      <input
        ref={ref}
        type="file"
        name={name}
        accept={accept}
        disabled={disabled}
        className="ui-file-input-native"
        onChange={(e) => {
          setFileName(e.target.files?.[0]?.name ?? null);
          onChange?.(e);
        }}
        {...rest}
      />
      <span className="btn btn-secondary btn-sm ui-file-input-btn" aria-hidden="true">
        {buttonLabel}
      </span>
      {showFileName && (
        <span className="ui-file-input-name">{fileName ?? "No file chosen"}</span>
      )}
    </label>
  );
});
