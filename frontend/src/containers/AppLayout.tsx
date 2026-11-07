import { Link, Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useLogout } from "../hooks/useAuth";
import { useAuthStore } from "../stores/authStore";

export function AppLayout() {
  const username = useAuthStore((state) => state.user?.username);
  const logout = useLogout();
  const { pathname } = useLocation();
  return (
    <>
      <header className="app-header">
        <Link to="/" className="brand">
          Slowboard
        </Link>
        <div className="app-header__user">
          <span>{username}</span>
          <button
            type="button"
            className="button button--quiet"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            Log out
          </button>
        </div>
      </header>
      <main className="app-main">
        {/* The key clears a caught error when the player navigates elsewhere. */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </>
  );
}
