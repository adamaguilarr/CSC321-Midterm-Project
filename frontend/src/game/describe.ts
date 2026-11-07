import type { GameDetail, GameSummary, Seat } from "../types/api";

export const seatOf = (game: GameSummary, color: Seat["color"]): Seat | undefined =>
  game.players.find((seat) => seat.color === color);

export function opponentOf(game: GameSummary): Seat | undefined {
  return game.players.find((seat) => seat.color !== game.your_color);
}

export function describeResult(game: GameSummary): string {
  if (game.end_reason === "draw_rule") {
    return "Draw: 40 moves passed without a capture or a man moving.";
  }
  const winner = game.winner?.username ?? "Your opponent";
  const youWon =
    game.winner !== null && seatOf(game, game.your_color ?? "red")?.id === game.winner.id;
  const headline = youWon ? "You won" : `${winner} won`;
  return game.end_reason === "resignation"
    ? `${headline} by resignation.`
    : `${headline}: the other side has no legal moves.`;
}

export function lastMoveSquares(game: GameDetail): string[] {
  const last = game.moves[game.moves.length - 1];
  return last ? last.notation.split(/[-x]/) : [];
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
