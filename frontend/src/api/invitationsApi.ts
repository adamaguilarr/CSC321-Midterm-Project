import type { Invitation, InvitationPayload, Paginated, UserSummary } from "../types/api";
import { apiClient } from "./client";

export type InvitationResponse = "accept" | "decline" | "cancel";

export const invitationsApi = {
  listPending: () =>
    apiClient
      .get<Paginated<Invitation>>("/invitations/", { params: { status: "pending" } })
      .then((response) => response.data.results),
  create: (payload: InvitationPayload) =>
    apiClient.post<Invitation>("/invitations/", payload).then((response) => response.data),
  respond: (id: number, response: InvitationResponse) =>
    apiClient.post<Invitation>(`/invitations/${id}/${response}/`).then((result) => result.data),
};

export const usersApi = {
  search: (term: string) =>
    apiClient
      .get<Paginated<UserSummary>>("/users/", { params: { search: term } })
      .then((response) => response.data.results),
};
