import { useNavigate } from "react-router-dom";
import { InvitationRow } from "../components/InvitationRow";
import { useAuthStore } from "../stores/authStore";
import { usePendingInvitations, useRespondToInvitation } from "../hooks/useInvitations";

export function InvitationsContainer() {
  const userId = useAuthStore((state) => state.user?.id);
  const invitations = usePendingInvitations();
  const respond = useRespondToInvitation();
  const navigate = useNavigate();

  if (!invitations.data || invitations.data.length === 0) return null;

  return (
    <section className="panel" aria-label="Invitations">
      <h2 className="panel__title">Invitations</h2>
      <ul className="invitation-list">
        {invitations.data.map((invitation) => (
          <InvitationRow
            key={invitation.id}
            invitation={invitation}
            direction={invitation.invitee.id === userId ? "incoming" : "outgoing"}
            busy={respond.isPending && respond.variables?.id === invitation.id}
            onRespond={(response) =>
              respond.mutate(
                { id: invitation.id, response },
                {
                  onSuccess: (updated) => {
                    if (updated.game !== null) void navigate(`/games/${updated.game}`);
                  },
                },
              )
            }
          />
        ))}
      </ul>
    </section>
  );
}
