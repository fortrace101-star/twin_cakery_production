import { useEffect } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { Workspace } from "./components/erp/workspace";
import { WorkspaceProvider } from "./components/erp/store";
import { DensityProvider } from "./lib/density";
import { modules } from "./components/erp/data";

function applyMeta(title: string, description: string) {
  document.title = title;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", description);
}

function DashboardPage() {
  useEffect(() => {
    applyMeta(
      "Dashboard — Twin Cakery ERP",
      "Twin Cakery's operational overview of revenue, orders, production, stock and deliveries.",
    );
  }, []);
  return <Workspace />;
}

function ModulePage() {
  const { module = "" } = useParams();
  const config = modules.find((m) => m.id === module);
  useEffect(() => {
    applyMeta(
      `${config?.label || "Unavailable"} — Twin Cakery ERP`,
      `Manage ${config?.label.toLowerCase() || "operations"} in the Twin Cakery business workspace.`,
    );
  }, [config?.label]);
  if (!config) return <Navigate to="/not-found" replace />;
  return <Workspace key={module} module={module} />;
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <DensityProvider>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/workspace/:module" element={<ModulePage />} />
          <Route path="/not-found" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </DensityProvider>
    </WorkspaceProvider>
  );
}
