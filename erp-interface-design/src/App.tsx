import { useEffect, useRef } from "react";
import { Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import { Workspace } from "./components/erp/workspace";
import { WorkspaceProvider, useWorkspace } from "./components/erp/store";
import { DensityProvider } from "./lib/density";
import { modules } from "./components/erp/data";
import { PrivateRoute } from "./components/erp/PrivateRoute";
import { LoginPage } from "./pages/LoginPage";
import { SignUpPage } from "./pages/SignUpPage";
import { ClaimAdminPage } from "./pages/ClaimAdminPage";
import { hasExistingUser } from "./lib/api";

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

  // The dashboard isn't part of the modules table, so render it directly —
  // this keeps /workspace/dashboard working (matches notification deep links).
  if (module === "dashboard") return <Workspace module="dashboard" />;
  // "/workspace/" (empty module) is a stray link — send the user home to the
  // dashboard instead of showing a dead 404.
  if (!module) return <Navigate to="/" replace />;
  if (!config) return <Navigate to="/not-found" replace />;
  // No `key` here on purpose: remounting Workspace on every module switch
  // would reset its local UI state (e.g. the sidebar collapsed flag). Keeping
  // a single instance lets navigation preserve that state.
  return <Workspace module={module} />;
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

function GuestPage() {
  const { user, loading } = useWorkspace();
  const navigate = useNavigate();
  const settledRef = useRef(false);

  useEffect(() => {
    // Already authed → the dashboard renders right here at "/", so there is
    // nothing to redirect to.
    if (user) return;

    // Wait for the restored session (me()) to settle before deciding where a
    // guest goes; otherwise a signed-in user whose token hasn't resolved yet
    // would be bounced to /login on a soft reload.
    if (loading) return;

    // Not authed → decide the entry point by whether the workspace already
    // has registered staff accounts ("history"). A fresh workspace with no
    // accounts is a first-run visitor, so we land on /signup; otherwise /login.
    if (!settledRef.current) {
      settledRef.current = true;
      void hasExistingUser().then((hasHistory) => {
        if (!user) {
          navigate(hasHistory ? "/login" : "/signup", { replace: true });
        }
      });
    }
  }, [loading, user, navigate]);

  // Authenticated → show the real dashboard at the default route.
  if (user) return <DashboardPage />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <p className="text-sm text-muted-foreground">Connecting to Twin Cakery…</p>
    </div>
  );
}
export default function App() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      try {
        const exists = await hasExistingUser();
        if (!exists) {
          localStorage.clear();
          sessionStorage.clear();
          navigate("/claim-admin", { replace: true });
        }
      } catch {
        // ignore
      }
    })();
  }, [navigate]);
  return (
    <WorkspaceProvider>
      <DensityProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/claim-admin" element={<ClaimAdminPage />} />
          <Route path="/" element={<GuestPage />} />
          <Route
            path="/workspace/:module"
            element={
              <PrivateRoute>
                <ModulePage />
              </PrivateRoute>
            }
          />
          <Route path="/not-found" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </DensityProvider>
    </WorkspaceProvider>
  );
}
