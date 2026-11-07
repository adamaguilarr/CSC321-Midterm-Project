import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  message: string;
  action?: ReactNode;
}

export function ErrorState({ title, message, action }: ErrorStateProps) {
  return (
    <div className="state state--error" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="state__actions">
        {action}
        <Link className="button button--quiet" to="/">
          Back to your games
        </Link>
      </div>
    </div>
  );
}
