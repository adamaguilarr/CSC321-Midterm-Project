/**
 * Client copy of backend/games/engine.py. It exists so the board can offer only legal
 * moves and block invalid ones before any request is sent. The server stays the
 * authority: it re-validates every move it receives.
 *
 * board[row][col] holds a piece code. Row 0 is rank 8 and column 0 is file a. The sign
 * of a code is the colour and its magnitude is the rank (1 = man, 2 = king).
 */
import type { Color } from "../types/api";

export const BOARD_SIZE = 8;
export const EMPTY = 0;
export const RED_MAN = 1;
export const RED_KING = 2;
export const WHITE_MAN = -1;
export const WHITE_KING = -2;

export interface Square {
  row: number;
  col: number;
}

export interface LegalMove {
  path: Square[];
  captures: Square[];
  notation: string;
}

export type Board = number[][];

const NOTATION_PATTERN = /^[a-h][1-8](?:-[a-h][1-8]|(?:x[a-h][1-8])+)$/;

export const opponent = (color: Color): Color => (color === "red" ? "white" : "red");

export const colorOf = (piece: number): Color | null =>
  piece === EMPTY ? null : piece > 0 ? "red" : "white";

export const isKing = (piece: number): boolean => Math.abs(piece) === RED_KING;

export const isDark = ({ row, col }: Square): boolean => (row + col) % 2 === 1;

export const sameSquare = (a: Square, b: Square): boolean => a.row === b.row && a.col === b.col;

export const squareName = ({ row, col }: Square): string =>
  `${String.fromCharCode(97 + col)}${BOARD_SIZE - row}`;

export const squareFromName = (name: string): Square => ({
  row: BOARD_SIZE - Number(name[1]),
  col: name.charCodeAt(0) - 97,
});

export function initialBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col) => {
      if (!isDark({ row, col })) return EMPTY;
      if (row < 3) return WHITE_MAN;
      if (row > 4) return RED_MAN;
      return EMPTY;
    }),
  );
}

const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

function directions(piece: number): [number, number][] {
  if (isKing(piece)) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }
  const forward = piece > 0 ? -1 : 1;
  return [
    [forward, -1],
    [forward, 1],
  ];
}

const toMove = (path: Square[], captures: Square[]): LegalMove => ({
  path,
  captures,
  notation: path.map(squareName).join(captures.length > 0 ? "x" : "-"),
});

/** `board` must have the moving piece lifted off its origin, so a king can loop through it. */
function jumpSequences(
  board: Board,
  piece: number,
  current: Square,
  path: Square[],
  captured: Square[],
): LegalMove[] {
  const enemy = opponent(colorOf(piece) as Color);
  const moves: LegalMove[] = [];
  for (const [dRow, dCol] of directions(piece)) {
    const over = { row: current.row + dRow, col: current.col + dCol };
    const land = { row: current.row + 2 * dRow, col: current.col + 2 * dCol };
    if (!inBounds(land.row, land.col)) continue;
    if (colorOf(board[over.row][over.col]) !== enemy) continue;
    if (captured.some((square) => sameSquare(square, over))) continue;
    if (board[land.row][land.col] !== EMPTY) continue;
    moves.push(...jumpSequences(board, piece, land, [...path, land], [...captured, over]));
  }
  if (moves.length === 0 && captured.length > 0) return [toMove(path, captured)];
  return moves;
}

/** All complete legal moves for `color`. If any capture exists, only captures. */
export function legalMoves(board: Board, color: Color): LegalMove[] {
  const scratch = board.map((row) => [...row]);
  const jumps: LegalMove[] = [];
  const steps: LegalMove[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = scratch[row][col];
      if (colorOf(piece) !== color) continue;
      const origin = { row, col };
      scratch[row][col] = EMPTY;
      jumps.push(...jumpSequences(scratch, piece, origin, [origin], []));
      scratch[row][col] = piece;
      for (const [dRow, dCol] of directions(piece)) {
        const target = { row: row + dRow, col: col + dCol };
        if (inBounds(target.row, target.col) && scratch[target.row][target.col] === EMPTY) {
          steps.push(toMove([origin, target], []));
        }
      }
    }
  }
  return jumps.length > 0 ? jumps : steps;
}

/** Why typed notation can't be played, or null if it can. Mirrors engine.resolve_move. */
export function notationProblem(board: Board, color: Color, text: string): string | null {
  if (!NOTATION_PATTERN.test(text)) {
    return 'Use algebraic notation: "c3-d4" for a step, "c3xe5xg7" for jumps.';
  }
  const origin = squareFromName(text.slice(0, 2));
  const piece = board[origin.row]?.[origin.col] ?? EMPTY;
  if (piece === EMPTY) return `There is no piece on ${squareName(origin)}.`;
  if (colorOf(piece) !== color) return `The piece on ${squareName(origin)} isn't yours.`;

  const moves = legalMoves(board, color);
  if (moves.some((move) => move.notation === text)) return null;
  if (moves[0] && moves[0].captures.length > 0) {
    if (text.includes("-")) return "A capture is available, so you must jump.";
    const longer = moves.find((move) => move.notation.startsWith(`${text}x`));
    if (longer) return `${text} stops too early: the jump must continue (${longer.notation}).`;
  }
  return `${text} is not a legal move.`;
}
