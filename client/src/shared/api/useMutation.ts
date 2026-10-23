import { useCallback } from "react";
import { logClientError } from "@/shared/lib/logger";
import { clientIdHeaders } from "./clientId";

interface MutationOptions {
  showToast: (message: string) => void;
}

interface RequestOptions extends RequestInit {
  errorMessage: string;
}

export type PostJson = <T = unknown>(
  url: string,
  body: unknown,
  errorMessage: string,
) => Promise<
  | { ok: true; data: T | null }
  | { ok: false; data: T | null }
>;

export function useMutation({ showToast }: MutationOptions) {
  const request = useCallback(
    async <T = unknown>(url: string, options: RequestOptions) => {
      const { errorMessage, ...init } = options;

      try {
        const headers = new Headers(init.headers);
        for (const [name, value] of Object.entries(clientIdHeaders())) {
          headers.set(name, value);
        }
        const res = await fetch(url, { ...init, headers });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          showToast(data?.error || errorMessage);
          return { ok: false as const, data: data as T | null };
        }

        return { ok: true as const, data: data as T | null };
      } catch (error) {
        logClientError("api.mutation_failed", error, {
          method: init.method ?? "GET",
          url,
        });
        showToast(errorMessage);
        return { ok: false as const, data: null };
      }
    },
    [showToast],
  );

  const postJson: PostJson = useCallback(
    <T = unknown>(url: string, body: unknown, errorMessage: string) =>
      request<T>(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        errorMessage,
      }),
    [request],
  );

  return { request, postJson };
}
