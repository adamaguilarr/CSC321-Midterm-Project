import { useMutation, useQuery } from "@tanstack/react-query";
import { authApi } from "../api/authApi";
import { useAuthStore } from "../stores/authStore";

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: setSession,
    meta: { inlineErrors: true },
  });
}

export function useRegister() {
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: setSession,
    meta: { inlineErrors: true },
  });
}

export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession);
  return useMutation({
    mutationFn: authApi.logout,
    // Sign out locally even if the server can't be reached.
    onSettled: () => clearSession(),
    meta: { inlineErrors: true },
  });
}

export function useCurrentUser() {
  const storedUser = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    placeholderData: storedUser ?? undefined,
  });
}
