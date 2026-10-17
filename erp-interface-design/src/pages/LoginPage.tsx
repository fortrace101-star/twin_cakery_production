import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/components/erp/store";
import logo from "@/assets/twin-cakery-logo.png";

export function LoginPage() {
  const { signIn, authError, connected, user } = useWorkspace();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Sign in — Twin Cakery ERP";
  }, []);

  useEffect(() => {
    if (connected && user) {
      // Small delay so the route guard doesn't flash on soft reload. The
      // dashboard lives at "/", so send the user there.
      const t = setTimeout(() => navigate("/", { replace: true }), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [connected, user]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    const ok = await signIn(username.trim(), password);
    setBusy(false);
    if (!ok) setError(authError || "Sign in failed. Check your credentials.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="text-center">
          <div className="flex justify-center">
            <img src={logo} alt="Twin Cakery logo" className="h-16 w-16 rounded-xl bg-white object-contain p-2" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Twin Cakery</h1>
          <p className="text-sm text-muted-foreground">Sign in to your business workspace.</p>
        </div>

        <form className="erp-form mt-6 space-y-4" onSubmit={submit} noValidate>
          <div>
            <label htmlFor="username" className="mb-1 block text-xs font-medium text-muted-foreground">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              disabled={busy}
              placeholder="e.g. manager"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-muted-foreground">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={busy}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-xs text-muted-foreground text-center">
          Demo credentials: <code className="text-foreground">placeholder</code> /{" "}
          <code className="text-foreground">TwinCakery123!</code>
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          New here?{" "}
          <a href="/signup" className="text-primary underline-offset-2 hover:underline">
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}