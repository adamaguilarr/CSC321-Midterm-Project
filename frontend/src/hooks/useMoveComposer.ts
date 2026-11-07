import { useCallback, useMemo, useState } from "react";
import {
  jumpedSquares,
  movableSquares,
  nextSquares,
  pickSquare,
  previewBoard,
} from "../game/composer";
import {
  legalMoves,
  sameSquare,
  squareName,
  type Board,
  type LegalMove,
  type Square,
} from "../game/engine";
import type { Color } from "../types/api";

interface ComposerOptions {
  board: Board;
  color: Color | null;
  isYourTurn: boolean;
  /** True while a move is on its way to the server. */
  locked: boolean;
  onComplete: (move: LegalMove, reset: () => void) => void;
}

interface Draft {
  /** The board this draft was built on. A newer board discards the draft. */
  board: Board;
  path: Square[];
  hint: string | null;
}

const names = (squares: Square[]): Set<string> => new Set(squares.map(squareName));

export function useMoveComposer({ board, color, isYourTurn, locked, onComplete }: ComposerOptions) {
  const [draft, setDraft] = useState<Draft>({ board, path: [], hint: null });
  const current = draft.board === board ? draft : null;
  const path = useMemo(() => current?.path ?? [], [current]);
  const hint = current?.hint ?? null;

  const moves = useMemo(
    () => (isYourTurn && color ? legalMoves(board, color) : []),
    [board, color, isYourTurn],
  );

  const reset = useCallback(() => setDraft({ board, path: [], hint: null }), [board]);

  const pick = useCallback(
    (square: Square) => {
      if (locked || !color || !isYourTurn) return;
      const result = pickSquare(board, color, moves, path, square);
      if (result.kind === "reject") {
        setDraft({ board, path, hint: result.reason });
        return;
      }
      setDraft({ board, path: result.path, hint: null });
      if (result.kind === "complete") onComplete(result.move, reset);
    },
    [board, color, isYourTurn, locked, moves, onComplete, path, reset],
  );

  /** Picking a piece up selects it, without the toggle a click would apply. */
  const beginDrag = useCallback(
    (square: Square) => {
      const tail = path[path.length - 1];
      if (!tail || !sameSquare(tail, square)) setDraft({ board, path: [square], hint: null });
    },
    [board, path],
  );

  return useMemo(() => {
    const interactive = moves.length > 0 && !locked;
    return {
      path,
      hint,
      pick,
      beginDrag,
      reset,
      interactive,
      mustCapture: (moves[0]?.captures.length ?? 0) > 0,
      isMidChain: path.length > 1,
      displayBoard: previewBoard(board, path),
      selected: path.length > 0 ? path[path.length - 1] : null,
      targets: names(locked ? [] : nextSquares(moves, path)),
      movable: names(interactive ? movableSquares(moves, path) : []),
      jumped: names(jumpedSquares(moves, path)),
    };
  }, [beginDrag, board, hint, locked, moves, path, pick, reset]);
}
