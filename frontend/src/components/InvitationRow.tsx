import { timeAgo } from "../game/describe";
import type { Invitation } from "../types/api";
import type { InvitationResponse } from "../api/invitationsApi";

interface InvitationRowProps {
  invitation: Invitation;
  direction: "incoming" | "outgoing";
  busy: boolean;
  onRespond: (response: InvitationResponse) => void;
}

export function InvitationRow({ invitation, direction, busy, onRespond }: InvitationRowProps) {
  const isIncoming = direction === "incoming";
  const yourColor = isIncoming === (invitation.inviter_color === "red") ? "white" : "red";
  return (
    <li className="invitation">
      <span className="invitation__body">
        <span className="invitation__title">
          {isIncoming
            ? `${invitation.inviter.username} challenged you`
            : `Waiting for ${invitation.invitee.username}`}
        </span>
        <span className="game-card__meta">
          You play {yourColor} · {timeAgo(invitation.created_at)}
        </span>
      </span>
      <span className="invitation__actions">
        {isIncoming ? (
          <>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => onRespond("accept")}
            >
              Accept
            </button>
            <button
              type="button"
              className="button button--quiet"
              disabled={busy}
              onClick={() => onRespond("decline")}
            >
              Decline
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button button--quiet"
            disabled={busy}
            onClick={() => onRespond("cancel")}
          >
            Cancel
          </button>
        )}
      </span>
    </li>
  );
}
