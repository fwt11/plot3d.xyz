import Workspace from "@/pages/Workspace";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function App() {
  return (
    <ErrorBoundary>
      <Workspace />
      <ConfirmDialog />
    </ErrorBoundary>
  );
}
