import type { MoveRecord } from "../types/api";

interface MoveHistoryProps {
  moves: MoveRecord[];
}

export function MoveHistory({ moves }: MoveHistoryProps) {
  if (moves.length === 0) {
    return <p className="muted">No moves yet. Red plays first.</p>;
  }
  return (
    <ol className="history">
      {moves.map((move) => (
        <li key={move.number} className="history__item">
          <span className="history__number">{move.number}</span>
          <span
            className={`history__swatch history__swatch--${move.color}`}
            aria-label={move.color}
          />
          <code className="history__notation">{move.notation}</code>
          {move.crowned && <span className="history__tag">crowned</span>}
        </li>
      ))}
    </ol>
  );
}
