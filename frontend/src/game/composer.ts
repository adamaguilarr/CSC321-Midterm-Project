/**
 * The move a player is building, one square at a time. Pure logic, separate from React,
 * so that clicks and drags share a single set of rules.
 *
 * `path` is empty, or holds the selected origin and any jump landings so far. Every
 * path is a prefix of at least one legal move, so an invalid move can never be composed.
 */
import type { Color } from "../types/api";
import { colorOf, sameSquare, squareName, type Board, type LegalMove, type Square } from "./engine";

export type PickResult =
  | { kind: "path"; path: Square[] }
  | { kind: "complete"; path: Square[]; move: LegalMove }
  | { kind: "reject"; reason: string };

const startsWith = (move: LegalMove, path: Square[]): boolean =>
  path.length <= move.path.length && path.every((step, i) => sameSquare(step, move.path[i]));

export const candidatesFor = (moves: LegalMove[], path: Square[]): LegalMove[] =>
  moves.filter((move) => startsWith(move, path));

/** Squares the piece can go to next from the current path. */
export function nextSquares(moves: LegalMove[], path: Square[]): Square[] {
  if (path.length === 0) return [];
  return candidatesFor(moves, path)
    .filter((move) => move.path.length > path.length)
    .map((move) => move.path[path.length]);
}

/** Squares a piece may be picked up from: any origin, or just the jumper mid-chain. */
export function movableSquares(moves: LegalMove[], path: Square[]): Square[] {
  if (path.length > 1) return [path[path.length - 1]];
  const seen = new Map<string, Square>();
  for (const move of moves) seen.set(squareName(move.path[0]), move.path[0]);
  return [...seen.values()];
}

const mustJump = (moves: LegalMove[]): boolean => (moves[0]?.captures.length ?? 0) > 0;

function pickOrigin(board: Board, color: Color, moves: LegalMove[], square: Square): PickResult {
  const piece = board[square.row][square.col];
  if (colorOf(piece) !== color) {
    return { kind: "reject", reason: "Pick one of your own pieces." };
  }
  if (moves.some((move) => sameSquare(move.path[0], square))) {
    return { kind: "path", path: [square] };
  }
  return {
    kind: "reject",
    reason: mustJump(moves)
      ? "A capture is available, so you must jump."
      : "That piece has no legal moves.",
  };
}

export function pickSquare(
  board: Board,
  color: Color,
  moves: LegalMove[],
  path: Square[],
  square: Square,
): PickResult {
  if (path.length === 0) return pickOrigin(board, color, moves, square);

  const isMidChain = path.length > 1;
  const tail = path[path.length - 1];

  const extended = [...path, square];
  const candidates = candidatesFor(moves, extended);
  if (candidates.length > 0) {
    const finished = candidates.find((move) => move.path.length === extended.length);
    return finished
      ? { kind: "complete", path: extended, move: finished }
      : { kind: "path", path: extended };
  }

  if (sameSquare(square, tail)) {
    return { kind: "path", path: isMidChain ? path : [] };
  }
  if (isMidChain) {
    return { kind: "reject", reason: "Finish the jump: your piece must keep capturing." };
  }
  if (colorOf(board[square.row][square.col]) === color) {
    return pickOrigin(board, color, moves, square);
  }
  return {
    kind: "reject",
    reason: mustJump(moves)
      ? "A capture is available, so you must jump."
      : "That piece can't move there.",
  };
}

/** The board as it looks mid-composition: the piece has moved, captures are still shown. */
export function previewBoard(board: Board, path: Square[]): Board {
  if (path.length < 2) return board;
  const next = board.map((row) => [...row]);
  const start = path[0];
  const end = path[path.length - 1];
  const piece = board[start.row][start.col];
  next[start.row][start.col] = 0;
  next[end.row][end.col] = piece;
  return next;
}

/** Enemy pieces already jumped along the current path. */
export function jumpedSquares(moves: LegalMove[], path: Square[]): Square[] {
  if (path.length < 2) return [];
  return candidatesFor(moves, path)[0]?.captures.slice(0, path.length - 1) ?? [];
}
