import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="state state--error" role="alert">
        <h2>This page hit a problem</h2>
        <p>Your games are safe. They're stored on the server, not in this tab.</p>
        <div className="state__actions">
          <button type="button" className="button" onClick={() => window.location.assign("/")}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
