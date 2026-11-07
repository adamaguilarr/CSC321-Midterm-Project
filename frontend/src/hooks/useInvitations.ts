import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invitationsApi, usersApi, type InvitationResponse } from "../api/invitationsApi";
import { useDebouncedValue } from "./useDebouncedValue";

const INVITATION_KEY = ["invitations", "pending"] as const;
const POLL_MS = 10000;

export function usePendingInvitations() {
  return useQuery({
    queryKey: INVITATION_KEY,
    queryFn: invitationsApi.listPending,
    refetchInterval: POLL_MS,
  });
}

export function useSendInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: invitationsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATION_KEY }),
    meta: { inlineErrors: true },
  });
}

interface InvitationAnswer {
  id: number;
  response: InvitationResponse;
}

export function useRespondToInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response }: InvitationAnswer) => invitationsApi.respond(id, response),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", "list"] }),
    // Refresh on failure as well: a 409 means this row is out of date.
    onSettled: () => queryClient.invalidateQueries({ queryKey: INVITATION_KEY }),
  });
}

export function usePlayerSearch(term: string) {
  const debounced = useDebouncedValue(term.trim(), 250);
  return useQuery({
    queryKey: ["users", "search", debounced],
    queryFn: () => usersApi.search(debounced),
    enabled: debounced.length > 0,
    staleTime: 30000,
  });
}
