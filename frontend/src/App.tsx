import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "./containers/AppLayout";
import { ToastContainer } from "./containers/ToastContainer";
import { DashboardPage } from "./pages/DashboardPage";
import { GamePage } from "./pages/GamePage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RegisterPage } from "./pages/RegisterPage";
import { useAuthStore } from "./stores/authStore";

interface RedirectState {
  from?: string;
}

function RequireAuth() {
  const isSignedIn = useAuthStore((state) => state.token !== null);
  const { pathname } = useLocation();
  if (!isSignedIn) return <Navigate to="/login" replace state={{ from: pathname }} />;
  return <Outlet />;
}

function RequireGuest() {
  const isSignedIn = useAuthStore((state) => state.token !== null);
  const { state } = useLocation();
  const from = (state as RedirectState | null)?.from ?? "/";
  if (isSignedIn) return <Navigate to={from} replace />;
  return <Outlet />;
}

export function App() {
  return (
    <>
      <Routes>
        <Route element={<RequireGuest />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/games/:gameId" element={<GamePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
      <ToastContainer />
    </>
  );
}
