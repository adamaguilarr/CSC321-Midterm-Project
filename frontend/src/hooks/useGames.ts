import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gamesApi } from "../api/gamesApi";
import type { GameDetail, GameStatus } from "../types/api";

const WAITING_POLL_MS = 3000;
const OWN_TURN_POLL_MS = 15000;
const LIST_POLL_MS = 10000;

const gameKey = (id: number) => ["games", "detail", id] as const;

export function useGamesList(status: GameStatus) {
  return useInfiniteQuery({
    queryKey: ["games", "list", status],
    queryFn: ({ pageParam }) => gamesApi.list(status, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.next ? lastPageParam + 1 : undefined,
    refetchInterval: status === "active" ? LIST_POLL_MS : false,
  });
}

function pollInterval(game: GameDetail | undefined): number | false {
  if (!game || game.status !== "active") return false;
  return game.is_your_turn ? OWN_TURN_POLL_MS : WAITING_POLL_MS;
}

export function useGame(id: number) {
  return useQuery({
    queryKey: gameKey(id),
    queryFn: () => gamesApi.get(id),
    refetchInterval: (query) => pollInterval(query.state.data),
  });
}

/** Shared handling for anything that returns the updated game. */
function useGameMutation<TVariables>(
  id: number,
  mutationFn: (variables: TVariables) => Promise<GameDetail>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (game) => {
      queryClient.setQueryData(gameKey(id), game);
      void queryClient.invalidateQueries({ queryKey: ["games", "list"] });
    },
    // A rejection often means this client's view is stale, so resync it.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: gameKey(id) });
    },
  });
}

export function useSubmitMove(id: number) {
  return useGameMutation(id, (notation: string) => gamesApi.submitMove(id, notation));
}

export function useResign(id: number) {
  return useGameMutation(id, () => gamesApi.resign(id));
}
