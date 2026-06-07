"use client";

import { createContext, useContext, useState } from "react";

type EditModeContextValue = {
  editing: boolean;
  setEditing: (v: boolean) => void;
};

const EditModeContext = createContext<EditModeContextValue>({
  editing: false,
  setEditing: () => {},
});

export function useEditMode() {
  return useContext(EditModeContext);
}

/**
 * Provides inline edit-mode state to EditableField wrappers. Only mounted for
 * editors (see the marketing layout), so it never ships to public visitors.
 */
export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  return (
    <EditModeContext.Provider value={{ editing, setEditing }}>
      {children}
    </EditModeContext.Provider>
  );
}
