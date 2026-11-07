import { useMemo, useState } from "react";
import { GameCard } from "../components/GameCard";
import { LoadingState } from "../components/StatusViews";
import { useGamesList } from "../hooks/useGames";
import type { GameStatus } from "../types/api";

const TABS: { status: GameStatus; label: string }[] = [
  { status: "active", label: "In play" },
  { status: "completed", label: "Finished" },
];

export function GamesContainer() {
  const [status, setStatus] = useState<GameStatus>("active");
  const games = useGamesList(status);

  const items = useMemo(() => {
    const all = games.data?.pages.flatMap((page) => page.results) ?? [];
    // Stable sort: games awaiting you first, otherwise most recent first.
    return all.sort((a, b) => Number(b.is_your_turn) - Number(a.is_your_turn));
  }, [games.data]);

  return (
    <section aria-label="Your games">
      <div className="tabs" role="group" aria-label="Filter games">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            className={`tab ${status === tab.status ? "tab--active" : ""}`}
            aria-pressed={status === tab.status}
            onClick={() => setStatus(tab.status)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {games.isPending && <LoadingState label="Loading your games" />}
      {games.isError && (
        <div className="state state--error" role="alert">
          <p>{games.error.message}</p>
          <button type="button" className="button" onClick={() => void games.refetch()}>
            Try again
          </button>
        </div>
      )}
      {games.isSuccess && items.length === 0 && (
        <p className="empty">
          {status === "active"
            ? "No games in play. Challenge someone to set up a board."
            : "No finished games yet."}
        </p>
      )}
      {items.length > 0 && (
        <ul className="game-list">
          {items.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </ul>
      )}
      {games.hasNextPage && (
        <button
          type="button"
          className="button button--quiet load-more"
          disabled={games.isFetchingNextPage}
          onClick={() => void games.fetchNextPage()}
        >
          {games.isFetchingNextPage ? "Loading…" : "Show more"}
        </button>
      )}
    </section>
  );
}
