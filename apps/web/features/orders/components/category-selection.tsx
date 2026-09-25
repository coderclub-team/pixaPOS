"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type CategorySelection = {
  categoryId: string | null;
  setCategoryId: (id: string | null) => void;
};

const CategorySelectionContext = createContext<CategorySelection | null>(null);

/** Page-level category state shared between the app sidebar and the menu
 * browser. Only the /kot shell provides it — elsewhere the browser keeps
 * its own internal sidebar selection. */
export function CategorySelectionProvider({ children }: { children: ReactNode }) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  return (
    <CategorySelectionContext.Provider value={{ categoryId, setCategoryId }}>
      {children}
    </CategorySelectionContext.Provider>
  );
}

/** Null outside the /kot shell provider (dashboard keeps local selection). */
export function useCategorySelection(): CategorySelection | null {
  return useContext(CategorySelectionContext);
}
