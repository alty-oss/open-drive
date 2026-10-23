import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { setClientId } from "@/shared/api/clientId";
import { logClientError } from "@/shared/lib/logger";
import { checkAuthentication } from "./authApi";

export interface FileChangeData {
  event: string;
  path?: string;
  from?: string;
  to?: string;

  paths?: string[];

  originId?: string;
}

export type SocketStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"
  | "unauthenticated";

export interface SocketState {
  socketRef: MutableRefObject<WebSocket | null>;
  status: SocketStatus;
  connected: boolean;
  authenticated: boolean | null;
  error: string | null;
}

interface UseSocketOptions {
  onUnauthenticated?: () => void;
}

export function useSocket(
  onFileChange: (data: FileChangeData) => void,
  options: UseSocketOptions = {},
) {
  const socketRef = useRef<WebSocket | null>(null);
  const callbackRef = useRef(onFileChange);
  const onUnauthenticatedRef = useRef(options.onUnauthenticated);
  const unauthenticatedRef = useRef(false);
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  callbackRef.current = onFileChange;
  onUnauthenticatedRef.current = options.onUnauthenticated;

  useEffect(() => {
    const abortController = new AbortController();
    let mounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 500;
    let intentionallyClosed = false;

    const revalidateSession = async () => {
      try {
        const isAuthenticated = await checkAuthentication(
          abortController.signal,
        );
        if (!mounted) return;
        setAuthenticated(isAuthenticated);
        setError(null);

        if (isAuthenticated) {
          unauthenticatedRef.current = false;
          setStatus("connected");
        } else {
          unauthenticatedRef.current = true;
          setStatus("unauthenticated");
          socketRef.current?.close();
          onUnauthenticatedRef.current?.();
        }
      } catch (err) {
        if (!mounted || abortController.signal.aborted) return;
        logClientError("socket.session_revalidation_failed", err);
        setAuthenticated(null);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Unable to validate the session");
      }
    };

    const connect = () => {
      if (!mounted || intentionallyClosed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/events`);
      let socketId: string | null = null;
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectDelay = 500;
        unauthenticatedRef.current = false;
        setStatus("connecting");
        setError(null);
        revalidateSession();
      };

      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data) as FileChangeData & {
            type?: string;
            originId?: string;
          };
          if (data.type === "hello") {
            socketId = data.originId ?? null;
            setClientId(socketId);
            return;
          }
          if (data.type === "file-change") {
            if (data.originId && data.originId === socketId) return;
            callbackRef.current(data);
          }
        } catch (err) {
          logClientError("socket.message_parse_failed", err);
        }
      };

      socket.onclose = (event) => {
        setClientId(null);
        if (!mounted || intentionallyClosed || unauthenticatedRef.current) return;
        setStatus("disconnected");
        setError(event.reason || "Connection closed");
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 10_000);
      };

      socket.onerror = () => {
        if (!mounted) return;
        setStatus("error");
        setAuthenticated(null);
        setError("Connection failed WebSocket");
      };
    };

    connect();

    return () => {
      mounted = false;
      intentionallyClosed = true;
      abortController.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
      setClientId(null);
    };
  }, []);

  return {
    socketRef,
    status,
    connected: status === "connected",
    authenticated,
    error,
  } satisfies SocketState;
}
