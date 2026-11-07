import { GamesContainer } from "../containers/GamesContainer";
import { InvitationsContainer } from "../containers/InvitationsContainer";
import { NewGameContainer } from "../containers/NewGameContainer";
import { useCurrentUser } from "../hooks/useAuth";

export function DashboardPage() {
  const { data: user } = useCurrentUser();
  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1>Your games</h1>
        {user && (
          <dl className="record" aria-label="Your record">
            <div>
              <dt>Won</dt>
              <dd>{user.profile.wins}</dd>
            </div>
            <div>
              <dt>Lost</dt>
              <dd>{user.profile.losses}</dd>
            </div>
            <div>
              <dt>Drawn</dt>
              <dd>{user.profile.draws}</dd>
            </div>
          </dl>
        )}
      </header>
      <div className="dashboard__columns">
        <div className="dashboard__main">
          <InvitationsContainer />
          <GamesContainer />
        </div>
        <NewGameContainer />
      </div>
    </div>
  );
}
