import { isEditor } from "@/lib/cms-edit";
import { EditableFieldClient } from "./EditableFieldClient";

type Props = {
  /** CMS page key, e.g. "home" or "about". */
  pageKey: string;
  /** Field key within the page, e.g. "headline" or "body". */
  fieldKey: string;
  /** Editor control to render. richtext → textarea of HTML; image → URL input. */
  type?: "text" | "richtext" | "image";
  /** Raw stored value (what the editor edits). */
  value: unknown;
  className?: string;
  /** The normal rendered output shown to everyone. */
  children: React.ReactNode;
};

/**
 * Wraps a rendered CMS field so editors can edit it in place. For anonymous
 * visitors this is a pure server passthrough — it renders `children` and ships
 * NO client JS. Only when the request is from an editor do we mount the client
 * editor (which coordinates with EditModeProvider + EditToolbar).
 */
export async function EditableField({
  pageKey,
  fieldKey,
  type = "text",
  value,
  className,
  children,
}: Props) {
  if (!(await isEditor())) {
    return <>{children}</>;
  }
  return (
    <EditableFieldClient
      pageKey={pageKey}
      fieldKey={fieldKey}
      type={type}
      value={typeof value === "string" ? value : ""}
      className={className}
    >
      {children}
    </EditableFieldClient>
  );
}
