import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "./stores/authStore";
import { toast } from "./stores/toastStore";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // A first load shows its error in the page. A failed background refresh has
      // nowhere else to surface, because stale data is still on screen.
      if (query.state.data !== undefined && error.status !== 401) toast.error(error.message);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!mutation.meta?.inlineErrors && error.status !== 401) toast.error(error.message);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 2000,
      retry: (failureCount, error) => !error.isClientError && failureCount < 2,
    },
  },
});

// Logging out, or a revoked token, must not leave one player's data for the next.
useAuthStore.subscribe((state, previous) => {
  if (previous.token && !state.token) queryClient.clear();
});
