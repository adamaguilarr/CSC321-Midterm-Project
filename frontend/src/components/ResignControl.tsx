import { useState } from "react";

interface ResignControlProps {
  disabled: boolean;
  onConfirm: () => void;
}

export function ResignControl({ disabled, onConfirm }: ResignControlProps) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        className="button button--quiet"
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        Resign
      </button>
    );
  }
  return (
    <div className="resign" role="group" aria-label="Confirm resignation">
      <span>End this game as a loss?</span>
      <button type="button" className="button button--danger" onClick={onConfirm}>
        Resign
      </button>
      <button type="button" className="button button--quiet" onClick={() => setConfirming(false)}>
        Keep playing
      </button>
    </div>
  );
}
