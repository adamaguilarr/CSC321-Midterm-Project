import type { GameDetail, GameStatus, GameSummary, Paginated } from "../types/api";
import { apiClient } from "./client";

export const gamesApi = {
  list: (status: GameStatus, page: number) =>
    apiClient
      .get<Paginated<GameSummary>>("/games/", { params: { status, page } })
      .then((response) => response.data),
  get: (id: number) => apiClient.get<GameDetail>(`/games/${id}/`).then((response) => response.data),
  submitMove: (id: number, notation: string) =>
    apiClient
      .post<GameDetail>(`/games/${id}/moves/`, { notation })
      .then((response) => response.data),
  resign: (id: number) =>
    apiClient.post<GameDetail>(`/games/${id}/resign/`).then((response) => response.data),
};
