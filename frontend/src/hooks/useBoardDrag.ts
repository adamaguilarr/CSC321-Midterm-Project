import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { BOARD_SIZE, sameSquare, squareFromName, type Square } from "../game/engine";

const DRAG_THRESHOLD_PX = 6;

interface DragOptions {
  gridRef: RefObject<HTMLDivElement | null>;
  flipped: boolean;
  canDrag: (square: Square) => boolean;
  onDragStart: (square: Square) => void;
  onDrop: (square: Square) => void;
}

function squareAtPoint(grid: HTMLElement, flipped: boolean, x: number, y: number): Square | null {
  const rect = grid.getBoundingClientRect();
  const displayCol = Math.floor(((x - rect.left) / rect.width) * BOARD_SIZE);
  const displayRow = Math.floor(((y - rect.top) / rect.height) * BOARD_SIZE);
  const inside =
    displayCol >= 0 && displayCol < BOARD_SIZE && displayRow >= 0 && displayRow < BOARD_SIZE;
  if (!inside) return null;
  return flipped
    ? { row: BOARD_SIZE - 1 - displayRow, col: BOARD_SIZE - 1 - displayCol }
    : { row: displayRow, col: displayCol };
}

/**
 * Click-and-drag built on pointer events, so mouse and touch share one code path. The
 * dragged piece moves by writing a transform straight to the DOM, which means the
 * pointer moving never re-renders the board.
 */
export function useBoardDrag(options: DragOptions) {
  const { gridRef } = options;
  const [draggingFrom, setDraggingFrom] = useState<Square | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const stopListening = useRef<(() => void) | null>(null);

  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  const positionGhost = useCallback(() => {
    const grid = gridRef.current;
    const ghost = ghostRef.current;
    if (!grid || !ghost) return;
    const rect = grid.getBoundingClientRect();
    const half = rect.width / BOARD_SIZE / 2;
    const x = pointer.current.x - rect.left - half;
    const y = pointer.current.y - rect.top - half;
    ghost.style.transform = `translate(${x}px, ${y}px)`;
  }, [gridRef]);

  // The ghost mounts on the render after the drag starts, so place it before paint.
  useLayoutEffect(() => {
    if (draggingFrom) positionGhost();
  }, [draggingFrom, positionGhost]);

  useEffect(() => () => stopListening.current?.(), []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      suppressClick.current = false;
      if (!event.isPrimary || event.button !== 0) return;
      const element = (event.target as HTMLElement).closest<HTMLElement>("[data-square]");
      const name = element?.dataset.square;
      if (!name) return;
      const origin = squareFromName(name);
      if (!latest.current.canDrag(origin)) return;

      const startX = event.clientX;
      const startY = event.clientY;
      let dragging = false;

      const handleMove = (move: globalThis.PointerEvent) => {
        pointer.current = { x: move.clientX, y: move.clientY };
        if (!dragging) {
          if (Math.hypot(move.clientX - startX, move.clientY - startY) < DRAG_THRESHOLD_PX) return;
          dragging = true;
          suppressClick.current = true;
          latest.current.onDragStart(origin);
          setDraggingFrom(origin);
        }
        positionGhost();
      };

      const finish = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleCancel);
        stopListening.current = null;
        setDraggingFrom(null);
      };

      const handleUp = (up: globalThis.PointerEvent) => {
        finish();
        const grid = gridRef.current;
        if (!dragging || !grid) return;
        const target = squareAtPoint(grid, latest.current.flipped, up.clientX, up.clientY);
        if (target && !sameSquare(target, origin)) latest.current.onDrop(target);
      };

      const handleCancel = () => finish();

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleCancel);
      stopListening.current = finish;
    },
    [gridRef, positionGhost],
  );

  /** A drag ends with a click event on the board; it must not also count as a pick. */
  const onClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      event.stopPropagation();
    }
  }, []);

  return { draggingFrom, ghostRef, onPointerDown, onClickCapture };
}
