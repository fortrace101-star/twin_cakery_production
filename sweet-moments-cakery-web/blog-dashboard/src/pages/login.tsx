import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { blogApi } from "@/lib/blog-api";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await blogApi.login(username.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <h1>Sign in</h1>
      <p className="login-hint">
        Use a Twin Cakery ERP account. Only staff with the <code>content.*</code> permissions
        (Admin / Proprietor) can write blog posts.
      </p>
      <form className="blog-form" onSubmit={submit}>
        <label className="field">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. manager"
            autoComplete="username"
            autoFocus
            required
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="form-message">{error}</p>}
        <button type="submit" className="round-cta" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
