import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getAdminAuthSession, signInAdminAction } from "@/lib/auth/admin-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Operator sign-in - Portfolio OS" },
      {
        name: "description",
        content: "Authenticate to reach the Portfolio OS control dashboard.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Operator sign-in - Portfolio OS" },
      { property: "og:description", content: "Authenticate to reach the control dashboard." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void getAdminAuthSession().then((session) => {
      if (session.authenticated) void navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const res = await signInAdminAction({
        data: {
          email,
          password,
          isSignUp: mode === "signup",
          ...(mode === "signup" ? { setupToken } : {}),
        },
      });

      if (!res.ok) {
        throw new Error(res.error || "Authentication failed");
      }

      toast.success(res.message || "Authenticated successfully.");
      void navigate({ to: "/admin" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setPending(false);
    }
  }

  const fieldClass =
    "mt-2 w-full border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-signal";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background grid-paper px-4">
      <div className="w-full max-w-sm border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="label-mono text-foreground">Operator access</p>
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <label htmlFor="email" className="label-mono text-muted-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
          />

          <div className="mt-5">
            <label htmlFor="password" className="label-mono text-muted-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={mode === "signup" ? 12 : 1}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={fieldClass}
            />
          </div>

          {mode === "signup" ? (
            <div className="mt-5">
              <label htmlFor="setup-token" className="label-mono text-muted-foreground">
                Setup token
              </label>
              <input
                id="setup-token"
                type="password"
                required
                autoComplete="off"
                value={setupToken}
                onChange={(event) => setSetupToken(event.target.value)}
                className={fieldClass}
                aria-describedby="setup-token-hint"
              />
              <p id="setup-token-hint" className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                The ADMIN_SETUP_TOKEN secret you configured on the server. Password must be 12+
                characters.
              </p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="label-mono mt-7 w-full bg-foreground py-3.5 text-background disabled:opacity-50"
          >
            {pending ? "Verifying…" : mode === "signin" ? "Sign in →" : "Create operator →"}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="label-mono mt-4 w-full py-2 text-muted-foreground hover:text-signal-text"
          >
            {mode === "signin" ? "Need an account? Register" : "Have an account? Sign in"}
          </button>
        </form>

        <p className="border-t border-border px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
          Registration only works before the first operator exists and requires the server setup
          token.
        </p>
      </div>
    </div>
  );
}
