import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/components/erp/store";

export function PrivateRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    // Let `me()` settle on soft reload; otherwise route to /login.
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Connecting to Twin Cakery…</p>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}