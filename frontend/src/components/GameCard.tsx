import { Link } from "react-router-dom";
import { describeResult, opponentOf, timeAgo } from "../game/describe";
import type { GameSummary } from "../types/api";

interface GameCardProps {
  game: GameSummary;
}

export function GameCard({ game }: GameCardProps) {
  const opponent = opponentOf(game);
  const isFinished = game.status === "completed";
  return (
    <li>
      <Link
        to={`/games/${game.id}`}
        className={`game-card ${game.is_your_turn ? "game-card--turn" : ""}`}
      >
        <span className={`game-card__swatch game-card__swatch--${game.your_color}`} />
        <span className="game-card__body">
          <span className="game-card__title">vs {opponent?.username ?? "unknown"}</span>
          <span className="game-card__meta">
            {isFinished
              ? describeResult(game)
              : `${game.move_count} ${game.move_count === 1 ? "move" : "moves"} · ${timeAgo(game.updated_at)}`}
          </span>
        </span>
        {!isFinished && (
          <span className={`pill ${game.is_your_turn ? "pill--turn" : ""}`}>
            {game.is_your_turn ? "Your move" : "Waiting"}
          </span>
        )}
      </Link>
    </li>
  );
}
