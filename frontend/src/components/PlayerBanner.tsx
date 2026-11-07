import type { Seat } from "../types/api";
import { CheckerPiece } from "./CheckerPiece";
import { RED_MAN, WHITE_MAN } from "../game/engine";

interface PlayerBannerProps {
  seat: Seat | undefined;
  isYou: boolean;
  isActive: boolean;
}

export function PlayerBanner({ seat, isYou, isActive }: PlayerBannerProps) {
  if (!seat) return null;
  return (
    <div className={`player ${isActive ? "player--active" : ""}`}>
      <span className="player__token">
        <CheckerPiece code={seat.color === "red" ? RED_MAN : WHITE_MAN} />
      </span>
      <span className="player__name">
        {seat.username}
        {isYou && <span className="player__you"> (you)</span>}
      </span>
      {isActive && <span className="player__turn">to move</span>}
    </div>
  );
}
