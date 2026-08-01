import Workspace from "@/pages/Workspace";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  return (
    <ErrorBoundary>
      <Workspace />
      <ConfirmDialog />
      <Analytics />
    </ErrorBoundary>
  );
}
