import { describe, expect, it } from "vitest";
import {
  jumpedSquares,
  movableSquares,
  nextSquares,
  pickSquare,
  previewBoard,
  type PickResult,
} from "./composer";
import {
  EMPTY,
  RED_MAN,
  WHITE_MAN,
  initialBoard,
  legalMoves,
  squareFromName as sq,
  squareName,
  type Board,
} from "./engine";

function boardWith(pieces: Record<string, number>): Board {
  const board: Board = Array.from({ length: 8 }, () => Array<number>(8).fill(EMPTY));
  for (const [name, piece] of Object.entries(pieces)) {
    const { row, col } = sq(name);
    board[row][col] = piece;
  }
  return board;
}

const names = (squares: { row: number; col: number }[]): string[] => squares.map(squareName).sort();

function expectPath(result: PickResult): { row: number; col: number }[] {
  if (result.kind !== "path") throw new Error(`Expected a path, got ${result.kind}`);
  return result.path;
}

describe("single-step moves", () => {
  const board = initialBoard();
  const moves = legalMoves(board, "red");

  it("selects a movable piece and shows its destinations", () => {
    const path = expectPath(pickSquare(board, "red", moves, [], sq("c3")));
    expect(names(nextSquares(moves, path))).toEqual(["b4", "d4"]);
  });

  it("completes on a legal destination", () => {
    const result = pickSquare(board, "red", moves, [sq("c3")], sq("d4"));
    expect(result.kind === "complete" && result.move.notation).toBe("c3-d4");
  });

  it("rejects an illegal destination before anything is sent", () => {
    expect(pickSquare(board, "red", moves, [sq("c3")], sq("f6")).kind).toBe("reject");
  });

  it("rejects the opponent's piece and an empty square", () => {
    expect(pickSquare(board, "red", moves, [], sq("b6")).kind).toBe("reject");
    expect(pickSquare(board, "red", moves, [], sq("d4")).kind).toBe("reject");
  });

  it("rejects a blocked piece", () => {
    const result = pickSquare(board, "red", moves, [], sq("b2"));
    expect(result.kind === "reject" && result.reason).toMatch(/no legal moves/);
  });

  it("deselects on a second click and switches between own pieces", () => {
    expect(expectPath(pickSquare(board, "red", moves, [sq("c3")], sq("c3")))).toEqual([]);
    expect(names(expectPath(pickSquare(board, "red", moves, [sq("c3")], sq("e3"))))).toEqual([
      "e3",
    ]);
  });
});

describe("mandatory captures", () => {
  const board = boardWith({ c3: RED_MAN, d4: WHITE_MAN, g3: RED_MAN });
  const moves = legalMoves(board, "red");

  it("offers only the capturing piece and explains why", () => {
    expect(names(movableSquares(moves, []))).toEqual(["c3"]);
    const result = pickSquare(board, "red", moves, [], sq("g3"));
    expect(result.kind === "reject" && result.reason).toMatch(/must jump/);
  });
});

describe("multi-jumps", () => {
  const board = boardWith({ c1: RED_MAN, d2: WHITE_MAN, d4: WHITE_MAN, f4: WHITE_MAN });
  const moves = legalMoves(board, "red");

  it("holds the path open until the chain ends, then completes the chosen branch", () => {
    const origin = expectPath(pickSquare(board, "red", moves, [], sq("c1")));
    const midway = expectPath(pickSquare(board, "red", moves, origin, sq("e3")));
    expect(names(nextSquares(moves, midway))).toEqual(["c5", "g5"]);
    const result = pickSquare(board, "red", moves, midway, sq("g5"));
    expect(result.kind === "complete" && result.move.notation).toBe("c1xe3xg5");
  });

  it("only allows the jumping piece to continue", () => {
    const path = [sq("c1"), sq("e3")];
    expect(names(movableSquares(moves, path))).toEqual(["e3"]);
    const result = pickSquare(board, "red", moves, path, sq("a1"));
    expect(result.kind === "reject" && result.reason).toMatch(/Finish the jump/);
  });

  it("previews the partial move and marks what has been jumped", () => {
    const path = [sq("c1"), sq("e3")];
    const preview = previewBoard(board, path);
    expect(preview[sq("c1").row][sq("c1").col]).toBe(EMPTY);
    expect(preview[sq("e3").row][sq("e3").col]).toBe(RED_MAN);
    expect(names(jumpedSquares(moves, path))).toEqual(["d2"]);
    expect(board[sq("c1").row][sq("c1").col]).toBe(RED_MAN);
  });
});
