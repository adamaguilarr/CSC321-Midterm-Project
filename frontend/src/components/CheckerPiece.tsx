import { colorOf, isKing } from "../game/engine";

interface CheckerPieceProps {
  code: number;
}

export function CheckerPiece({ code }: CheckerPieceProps) {
  return (
    <span className={`piece piece--${colorOf(code)}`} aria-hidden="true">
      {isKing(code) && (
        <svg className="piece__crown" viewBox="0 0 24 24">
          <path d="M3 18 1.5 7l6 4.5L12 4l4.5 7.5 6-4.5L21 18Z" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}
