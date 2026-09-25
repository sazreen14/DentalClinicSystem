import { createContext, useContext } from "react";

export const IdentityContext = createContext(null);
export function useIdentity() {
  const context = useContext(IdentityContext);
  if (!context) throw new Error("useIdentity must be used within IdentityProvider");
  return context;
}
