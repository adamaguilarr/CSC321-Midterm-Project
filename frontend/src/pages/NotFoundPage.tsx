import { ErrorState } from "../components/StatusViews";

export function NotFoundPage() {
  return <ErrorState title="Page not found" message="There's nothing at this address." />;
}
