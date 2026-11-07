import { memo } from "react";
import { colorOf, isDark, isKing, squareName } from "../game/engine";
import { CheckerPiece } from "./CheckerPiece";

interface BoardSquareProps {
  row: number;
  col: number;
  piece: number;
  isSelected: boolean;
  isTarget: boolean;
  isMovable: boolean;
  isJumped: boolean;
  isLastMove: boolean;
  isHidden: boolean;
}

function describe(name: string, piece: number, isTarget: boolean, isMovable: boolean): string {
  const occupant = colorOf(piece) ? `${colorOf(piece)} ${isKing(piece) ? "king" : "man"}` : "empty";
  const action = isTarget ? ", legal destination" : isMovable ? ", can move" : "";
  return `${name}, ${occupant}${action}`;
}

/**
 * Takes primitives only, so memo skips every square whose appearance didn't change.
 * Events are handled once on the board, so no per-square callbacks break that.
 */
export const BoardSquare = memo(function BoardSquare({
  row,
  col,
  piece,
  isSelected,
  isTarget,
  isMovable,
  isJumped,
  isLastMove,
  isHidden,
}: BoardSquareProps) {
  if (!isDark({ row, col })) {
    return <div role="gridcell" className="square square--light" />;
  }
  const name = squareName({ row, col });
  const classes = [
    "square",
    "square--dark",
    isSelected && "square--selected",
    isTarget && "square--target",
    isMovable && "square--movable",
    isJumped && "square--jumped",
    isLastMove && "square--last",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div role="gridcell" className={classes}>
      <button
        type="button"
        className="square__button"
        data-square={name}
        tabIndex={isMovable || isTarget || isSelected ? 0 : -1}
        aria-label={describe(name, piece, isTarget, isMovable)}
        aria-pressed={isSelected}
      >
        {piece !== 0 && !isHidden && <CheckerPiece code={piece} />}
      </button>
    </div>
  );
});
