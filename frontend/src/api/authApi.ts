import type { AuthSession, CurrentUser, LoginPayload, RegisterPayload } from "../types/api";
import { apiClient } from "./client";

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<AuthSession>("/auth/login/", payload).then((response) => response.data),
  register: (payload: RegisterPayload) =>
    apiClient.post<AuthSession>("/auth/register/", payload).then((response) => response.data),
  logout: () => apiClient.post<void>("/auth/logout/").then(() => undefined),
  me: () => apiClient.get<CurrentUser>("/auth/me/").then((response) => response.data),
};
