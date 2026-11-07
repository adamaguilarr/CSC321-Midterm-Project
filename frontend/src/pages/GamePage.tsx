import { Link, useParams } from "react-router-dom";
import { GameContainer } from "../containers/GameContainer";
import { NotFoundPage } from "./NotFoundPage";

export function GamePage() {
  const { gameId } = useParams();
  const id = Number(gameId);
  if (!Number.isInteger(id) || id <= 0) return <NotFoundPage />;
  return (
    <>
      <Link className="back-link" to="/">
        ← Your games
      </Link>
      {/* The key resets every piece of board state when moving between games. */}
      <GameContainer key={id} gameId={id} />
    </>
  );
}
