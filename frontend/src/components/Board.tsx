import { useMemo, useRef, type MouseEvent } from "react";
import {
  BOARD_SIZE,
  sameSquare,
  squareFromName,
  squareName,
  type Board as BoardMatrix,
  type Square,
} from "../game/engine";
import { useBoardDrag } from "../hooks/useBoardDrag";
import { BoardSquare } from "./BoardSquare";
import { CheckerPiece } from "./CheckerPiece";

interface BoardProps {
  board: BoardMatrix;
  /** Draw from White's seat, with rank 1 at the top. */
  flipped: boolean;
  selected: Square | null;
  targets: ReadonlySet<string>;
  movable: ReadonlySet<string>;
  jumped: ReadonlySet<string>;
  lastMove: ReadonlySet<string>;
  onPick: (square: Square) => void;
  onDragStart: (square: Square) => void;
}

export function Board({
  board,
  flipped,
  selected,
  targets,
  movable,
  jumped,
  lastMove,
  onPick,
  onDragStart,
}: BoardProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { draggingFrom, ghostRef, onPointerDown, onClickCapture } = useBoardDrag({
    gridRef,
    flipped,
    canDrag: (square) => movable.has(squareName(square)),
    onDragStart,
    onDrop: onPick,
  });

  const indexes = useMemo(() => {
    const ascending = board.map((_, index) => index);
    return flipped ? [...ascending].reverse() : ascending;
  }, [board, flipped]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const element = (event.target as HTMLElement).closest<HTMLElement>("[data-square]");
    if (element?.dataset.square) onPick(squareFromName(element.dataset.square));
  };

  const fileLabels = indexes.map((col) => String.fromCharCode(97 + col));
  const rankLabels = indexes.map((row) => BOARD_SIZE - row);

  return (
    <div className="board">
      <div className="board__ranks" aria-hidden="true">
        {rankLabels.map((rank) => (
          <span key={rank}>{rank}</span>
        ))}
      </div>
      <div
        ref={gridRef}
        role="grid"
        aria-label="Checkers board"
        className={`board__grid ${draggingFrom ? "board__grid--dragging" : ""}`}
        onClick={handleClick}
        onClickCapture={onClickCapture}
        onPointerDown={onPointerDown}
      >
        {indexes.map((row) => (
          <div role="row" key={row} className="board__row">
            {indexes.map((col) => {
              const square = { row, col };
              const name = squareName(square);
              return (
                <BoardSquare
                  key={col}
                  row={row}
                  col={col}
                  piece={board[row][col]}
                  isSelected={selected !== null && sameSquare(selected, square)}
                  isTarget={targets.has(name)}
                  isMovable={movable.has(name)}
                  isJumped={jumped.has(name)}
                  isLastMove={lastMove.has(name)}
                  isHidden={draggingFrom !== null && sameSquare(draggingFrom, square)}
                />
              );
            })}
          </div>
        ))}
        {draggingFrom && (
          <div ref={ghostRef} className="board__ghost" aria-hidden="true">
            <CheckerPiece code={board[draggingFrom.row][draggingFrom.col]} />
          </div>
        )}
      </div>
      <div className="board__files" aria-hidden="true">
        {fileLabels.map((file) => (
          <span key={file}>{file}</span>
        ))}
      </div>
    </div>
  );
}
