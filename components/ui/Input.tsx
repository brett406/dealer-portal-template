import "./input.css";

interface InputProps {
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "number" | "textarea";
  error?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}

export function Input({
  label,
  name,
  type = "text",
  error,
  required = false,
  placeholder,
  defaultValue,
  className = "",
}: InputProps) {
  const id = `input-${name}`;

  return (
    <div className={`form-field ${error ? "form-field-error" : ""} ${className}`.trim()}>
      <label htmlFor={id} className="form-label">
        {label}
        {required ? <span className="form-required" aria-hidden="true">*</span> : null}
      </label>

      {type === "textarea" ? (
        <textarea
          id={id}
          name={name}
          className="form-input form-textarea"
          placeholder={placeholder}
          defaultValue={defaultValue}
          required={required}
          rows={4}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          className="form-input"
          placeholder={placeholder}
          defaultValue={defaultValue}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}

      {error ? <p id={`${id}-error`} className="form-error-message" aria-live="polite">{error}</p> : null}
    </div>
  );
}
