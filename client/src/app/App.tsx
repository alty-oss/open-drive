import { useState, useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import Dashboard from "@/pages/dashboard/DashboardPage";
import Login from "@/pages/login/LoginPage";
import DownloadPage from "@/pages/public/DownloadPage";
import FileUnavailable from "@/pages/public/FileUnavailablePage";
import PublicAccess from "@/pages/public/PublicAccessPage";
import { checkAuthentication } from "./authApi";
import { resolvePublicRoute } from "./routing";
import { useTheme } from "./useTheme";

export default function App() {
  const route = resolvePublicRoute(window.location.pathname);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (route) return;
    checkAuthentication()
      .then(setAuthenticated)
      .catch(() => setAuthenticated(false));
  }, []);

  if (route?.kind === "missing") return <FileUnavailable />;
  if (route?.kind === "download") return <DownloadPage token={route.value} />;
  if (route?.kind === "public") return <PublicAccess value={route.value} />;

  if (authenticated === null) {
    return (
      <main
        className="flex min-h-dvh items-center justify-center gap-3.5 bg-app text-text"
        aria-label="Loading OpenDrive"
      >
        <div
          className="grid size-12 place-items-center overflow-hidden rounded-md bg-white"
          aria-hidden="true"
        >
          <img
            src="/brand-mark.png"
            alt=""
            className="block size-full object-cover"
          />
        </div>
        <div>
          <div className="text-base font-medium tracking-[-0.02em]">
            OpenDrive
          </div>
          <div className="mt-0.75 flex items-center gap-1.5 text-xs text-muted [&_svg]:size-[13px] [&_svg]:animate-spin">
            <LoaderCircle aria-hidden="true" />
            Preparing your files
          </div>
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <Login
        onLogin={() => setAuthenticated(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <Dashboard
      onLogout={() => setAuthenticated(false)}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}
