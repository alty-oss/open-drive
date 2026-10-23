import { useState } from "react";
import { cn } from "@/shared/ui/cn";
import { btn } from "@/shared/ui/styles";
import { AlertCircle, Check, Eye, EyeOff, Moon, Sun } from "lucide-react";
import { logClientError } from "@/shared/lib/logger";
import type { ThemeMode } from "@/app/useTheme";
import { login } from "@/app/authApi";

interface LoginProps {
  onLogin: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export default function Login({
  onLogin,
  theme,
  onToggleTheme,
}: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await login({ username, password, remember });
      if (result.ok) {
        onLogin();
      } else {
        setError(result.error || "Unable to sign in");
      }
    } catch (submitError) {
      logClientError("auth.login_failed", submitError);
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-app p-4 sm:p-6">
      <main className="w-[min(390px,100%)] rounded-xl bg-surface-alt p-6.5 px-5.5 shadow-e3 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-15 font-medium text-text [&>img]:size-9.5 [&>img]:rounded-md [&>img]:object-cover">
            <img src="/brand-mark.png" alt="" />
            <span>OpenDrive</span>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className={cn(btn.icon, "flex-none [&>svg]:size-4")}
            aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
        </div>

        <h1 className="mt-6.5 mb-5.5 text-22 font-medium tracking-[-0.025em] text-text">
          Sign in
        </h1>

        {error ? (
          <div className="mb-4.5 flex items-center gap-2 rounded-md border border-border-danger bg-danger-soft px-3 py-2.5 text-13 text-danger" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1.5 block text-13 font-medium text-text">
              Login
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoComplete="username"
              className="h-11 w-full px-3 text-13"
              placeholder="Your username"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-13 font-medium text-text">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="h-11 w-full px-3 pr-11 text-13"
                placeholder="Your password"
              />
              <button
                type="button"
                onClick={() => setShowPass((visible) => !visible)}
                className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-muted hover:bg-state-hover hover:text-text"
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <label className="flex w-fit cursor-pointer select-none items-center gap-2">


            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-xs border border-solid",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                remember
                  ? "border-accent bg-accent text-on-accent"
                  :


                    "border-border bg-surface-high text-transparent",
              )}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className="text-13 text-muted">Remember me</span>
          </label>

          <button
            type="submit"
            disabled={loading || !username || !password}









            className={cn(
              btn.primary,
              "mt-2 h-11 w-full text-13 font-medium disabled:shadow-none",
              loading
                ? "disabled:cursor-wait"
                : "disabled:cursor-not-allowed disabled:bg-surface-high disabled:text-muted",
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current" />
                Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
