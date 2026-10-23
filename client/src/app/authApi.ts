interface LoginCredentials {
  username: string;
  password: string;
  remember: boolean;
}

interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function checkAuthentication(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch("/api/auth/check", { signal });
  const body = await response.json();
  return body.authenticated === true;
}

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (response.ok) return { ok: true };
  const body = await response.json();
  return { ok: false, error: body.error || "Unable to sign in" };
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
