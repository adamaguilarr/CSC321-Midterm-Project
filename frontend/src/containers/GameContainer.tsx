import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { Board } from "../components/Board";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { MoveHistory } from "../components/MoveHistory";
import { NotationForm } from "../components/NotationForm";
import { PlayerBanner } from "../components/PlayerBanner";
import { ResignControl } from "../components/ResignControl";
import { ErrorState, LoadingState } from "../components/StatusViews";
import { describeResult, lastMoveSquares, opponentOf, seatOf } from "../game/describe";
import { notationProblem, opponent, type LegalMove } from "../game/engine";
import { useGame, useResign, useSubmitMove } from "../hooks/useGames";
import { useMoveComposer } from "../hooks/useMoveComposer";
import type { GameDetail } from "../types/api";
import type { ApiError } from "../api/errors";

interface GameContainerProps {
  gameId: number;
}

function errorCopy(error: ApiError): { title: string; message: string } {
  switch (error.status) {
    case 403:
      return { title: "This isn't your game", message: "Only its two players can open a board." };
    case 404:
      return { title: "Game not found", message: "That game doesn't exist." };
    case 0:
      return { title: "Can't reach the server", message: error.message };
    default:
      return { title: "We couldn't load this game", message: error.message };
  }
}

export function GameContainer({ gameId }: GameContainerProps) {
  const query = useGame(gameId);

  if (query.isPending) return <LoadingState label="Setting up the board" />;
  if (query.isError) {
    const retry: ReactNode = query.error.isClientError ? null : (
      <button type="button" className="button" onClick={() => void query.refetch()}>
        Try again
      </button>
    );
    return <ErrorState {...errorCopy(query.error)} action={retry} />;
  }
  return (
    <ErrorBoundary>
      <GameTable game={query.data} />
    </ErrorBoundary>
  );
}

function GameTable({ game }: { game: GameDetail }) {
  const submit = useSubmitMove(game.id);
  const resign = useResign(game.id);
  const { mutate: submitMove } = submit;

  const handleComplete = useCallback(
    (move: LegalMove, reset: () => void) => {
      submitMove(move.notation, { onError: reset });
    },
    [submitMove],
  );

  const composer = useMoveComposer({
    board: game.board,
    color: game.your_color,
    isYourTurn: game.is_your_turn,
    locked: submit.isPending,
    onComplete: handleComplete,
  });

  const lastMove = useMemo(() => new Set(lastMoveSquares(game)), [game]);
  const isActive = game.status === "active";
  const you = game.your_color ?? "red";

  useEffect(() => {
    const opponentName = opponentOf(game)?.username ?? "opponent";
    document.title = game.is_your_turn ? "Your move · Slowboard" : `vs ${opponentName} · Slowboard`;
    return () => {
      document.title = "Slowboard";
    };
  }, [game]);

  const handleTypedMove = (notation: string): string | null => {
    if (!game.your_color) return "You aren't a player in this game.";
    const problem = notationProblem(game.board, game.your_color, notation);
    if (!problem) submitMove(notation);
    return problem;
  };

  const handleResign = () => resign.mutate();

  return (
    <div className="table">
      <section className="table__play" aria-label="Game board">
        <PlayerBanner
          seat={seatOf(game, opponent(you))}
          isYou={false}
          isActive={isActive && game.current_turn === opponent(you)}
        />
        <Board
          board={composer.displayBoard}
          flipped={you === "white"}
          selected={composer.selected}
          targets={composer.targets}
          movable={composer.movable}
          jumped={composer.jumped}
          lastMove={lastMove}
          onPick={composer.pick}
          onDragStart={composer.beginDrag}
        />
        <PlayerBanner
          seat={seatOf(game, you)}
          isYou
          isActive={isActive && game.current_turn === you}
        />
      </section>

      <aside className="table__side">
        <div className={`status ${game.is_your_turn ? "status--turn" : ""}`} aria-live="polite">
          <p className="status__headline">
            {statusHeadline(game, composer.mustCapture, submit.isPending)}
          </p>
          <p className="status__hint">{composer.hint ?? statusDetail(game, composer.isMidChain)}</p>
          {composer.isMidChain && !submit.isPending && (
            <button type="button" className="button button--quiet" onClick={composer.reset}>
              Undo jump
            </button>
          )}
        </div>

        {isActive && (
          <NotationForm
            disabled={!game.is_your_turn || submit.isPending}
            onSubmit={handleTypedMove}
          />
        )}

        <div className="panel">
          <h2 className="panel__title">Moves</h2>
          <MoveHistory moves={game.moves} />
        </div>

        {isActive && <ResignControl disabled={resign.isPending} onConfirm={handleResign} />}
      </aside>
    </div>
  );
}

function statusHeadline(game: GameDetail, mustCapture: boolean, submitting: boolean): string {
  if (game.status === "completed") return describeResult(game);
  if (submitting) return "Sending your move…";
  if (!game.is_your_turn) return `Waiting for ${opponentOf(game)?.username ?? "your opponent"}`;
  return mustCapture ? "Your move: you must capture" : "Your move";
}

function statusDetail(game: GameDetail, isMidChain: boolean): string {
  if (game.status === "completed") return "This game is over. The record stays here.";
  if (isMidChain) return "Keep jumping: your piece has another capture.";
  if (!game.is_your_turn) return "The board is saved. Close this tab and come back any time.";
  return "Drag a highlighted piece, or click it and then a marked square.";
}
