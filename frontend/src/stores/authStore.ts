import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSession, CurrentUser } from "../types/api";

interface AuthState {
  token: string | null;
  user: CurrentUser | null;
  setSession: (session: AuthSession) => void;
  setUser: (user: CurrentUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: ({ token, user }) => set({ token, user }),
      setUser: (user) => set({ user }),
      clearSession: () => set({ token: null, user: null }),
    }),
    {
      name: "slowboard-auth",
      partialize: ({ token, user }) => ({ token, user }),
    },
  ),
);
