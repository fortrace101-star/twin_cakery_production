import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "@/lib/api";
import logo from "@/assets/twin-cakery-logo.png";

export function SignUpPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerCode, setRegisterCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    document.title = "Create account — Twin Cakery ERP";
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const result = await register({
        username,
        displayName: displayName || username,
        email,
        phone,
        password,
        confirmPassword,
        registerCode,
      });
      setSuccess(`Account created — logging you in as ${result.user.username}.`);
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="text-center">
          <div className="flex justify-center">
            <img src={logo} alt="Twin Cakery logo" className="h-16 w-16 rounded-xl bg-white object-contain p-2" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Join the Twin Cakery business workspace.
          </p>
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
              placeholder="e.g. jane.cakes"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="displayName" className="mb-1 block text-xs font-medium text-muted-foreground">
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              disabled={busy}
              placeholder="Jane Cakes"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-medium text-muted-foreground">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                disabled={busy}
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-xs font-medium text-muted-foreground">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                disabled={busy}
                placeholder="+1 555 000 1234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-medium text-muted-foreground">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                disabled={busy}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-xs font-medium text-muted-foreground">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                disabled={busy}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>
          </div>

<div>
            <label htmlFor="registerCode" className="mb-1 block text-xs font-medium text-muted-foreground">
              Staff register code
            </label>
            <input
              id="registerCode"
              name="registerCode"
              type="text"
              required
              disabled={busy}
              placeholder="TWIN-STF-XXXX-XXXX"
              value={registerCode}
              onChange={(e) => setRegisterCode(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="text-primary underline-offset-2 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}