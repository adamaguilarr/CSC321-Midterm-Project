import { describe, expect, it } from "vitest";
import type { Color } from "../types/api";
import {
  EMPTY,
  RED_KING,
  RED_MAN,
  WHITE_MAN,
  initialBoard,
  legalMoves,
  notationProblem,
  squareFromName,
  squareName,
  type Board,
} from "./engine";

function boardWith(pieces: Record<string, number>): Board {
  const board: Board = Array.from({ length: 8 }, () => Array<number>(8).fill(EMPTY));
  for (const [name, piece] of Object.entries(pieces)) {
    const { row, col } = squareFromName(name);
    board[row][col] = piece;
  }
  return board;
}

const notations = (board: Board, color: Color): string[] =>
  legalMoves(board, color)
    .map((move) => move.notation)
    .sort();

/** These positions and answers match backend/games/tests/test_engine.py, keeping the two in step. */
describe("legalMoves", () => {
  it("offers Red seven opening moves", () => {
    expect(notations(initialBoard(), "red")).toEqual(
      ["a3-b4", "c3-b4", "c3-d4", "e3-d4", "e3-f4", "g3-f4", "g3-h4"].sort(),
    );
  });

  it("moves men forward only", () => {
    expect(notations(boardWith({ d4: RED_MAN }), "red")).toEqual(["d4-c5", "d4-e5"]);
    expect(notations(boardWith({ d4: WHITE_MAN }), "white")).toEqual(["d4-c3", "d4-e3"]);
  });

  it("moves kings in all directions", () => {
    expect(notations(boardWith({ d4: RED_KING }), "red")).toEqual([
      "d4-c3",
      "d4-c5",
      "d4-e3",
      "d4-e5",
    ]);
  });

  it("makes capturing mandatory", () => {
    expect(notations(boardWith({ c3: RED_MAN, d4: WHITE_MAN, g3: RED_MAN }), "red")).toEqual([
      "c3xe5",
    ]);
  });

  it("stops men capturing backward but lets kings", () => {
    expect(notations(boardWith({ d4: RED_MAN, c3: WHITE_MAN }), "red")).not.toContain("d4xb2");
    expect(notations(boardWith({ d4: RED_KING, c3: WHITE_MAN }), "red")).toEqual(["d4xb2"]);
  });

  it("requires a multi-jump to complete", () => {
    expect(notations(boardWith({ a1: RED_MAN, b2: WHITE_MAN, d4: WHITE_MAN }), "red")).toEqual([
      "a1xc3xe5",
    ]);
  });

  it("offers each branch of a jump", () => {
    expect(
      notations(boardWith({ c1: RED_MAN, d2: WHITE_MAN, d4: WHITE_MAN, f4: WHITE_MAN }), "red"),
    ).toEqual(["c1xe3xc5", "c1xe3xg5"]);
  });

  it("doesn't let a king jump one piece twice", () => {
    expect(notations(boardWith({ c3: RED_KING, d4: WHITE_MAN }), "red")).toEqual(["c3xe5"]);
  });

  it("lets a king circle through its origin", () => {
    const board = boardWith({
      c3: RED_KING,
      d4: WHITE_MAN,
      d6: WHITE_MAN,
      b6: WHITE_MAN,
      b4: WHITE_MAN,
    });
    expect(notations(board, "red")).toContain("c3xe5xc7xa5xc3");
  });

  it("ends the turn when a man reaches the far rank", () => {
    expect(notations(boardWith({ b6: RED_MAN, c7: WHITE_MAN, e7: WHITE_MAN }), "red")).toEqual([
      "b6xd8",
    ]);
  });

  it("doesn't modify the board it's given", () => {
    const board = initialBoard();
    legalMoves(board, "red");
    expect(board).toEqual(initialBoard());
  });
});

describe("coordinates", () => {
  it("round-trips square names", () => {
    expect(squareFromName("a1")).toEqual({ row: 7, col: 0 });
    expect(squareName({ row: 0, col: 7 })).toBe("h8");
  });
});

describe("notationProblem", () => {
  it("accepts a legal move", () => {
    expect(notationProblem(initialBoard(), "red", "c3-d4")).toBeNull();
  });

  it.each(["", "c3", "c3d4", "C3-D4", "i3-d4", "c3-d4-e5"])("rejects malformed %j", (text) => {
    expect(notationProblem(initialBoard(), "red", text)).toMatch(/algebraic notation/);
  });

  it("explains each kind of illegal move", () => {
    expect(notationProblem(initialBoard(), "red", "d4-e5")).toMatch(/no piece/);
    expect(notationProblem(initialBoard(), "red", "b6-a5")).toMatch(/isn't yours/);
    expect(notationProblem(boardWith({ d4: RED_MAN }), "red", "d4-c3")).toMatch(/not a legal/);
    expect(
      notationProblem(boardWith({ c3: RED_MAN, d4: WHITE_MAN, g3: RED_MAN }), "red", "g3-f4"),
    ).toMatch(/must jump/);
    expect(
      notationProblem(boardWith({ a1: RED_MAN, b2: WHITE_MAN, d4: WHITE_MAN }), "red", "a1xc3"),
    ).toMatch(/stops too early/);
  });
});
