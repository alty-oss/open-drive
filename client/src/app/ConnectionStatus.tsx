import type { SocketState } from "./useSocket";

interface ConnectionStatusProps {
  socket: Pick<SocketState, "status" | "error">;
}

export default function ConnectionStatus({ socket }: ConnectionStatusProps) {
  if (socket.status === "connected") return null;

  const label =
    socket.status === "connecting"
      ? "Reconnecting..."
      : socket.status === "unauthenticated"
        ? "Session expired"
        : "Offline";

  return (
    <div
      className="fixed top-3 right-3 z-[600] rounded-full bg-status px-3 py-1.5 text-11 font-medium text-status-fg shadow-e2"
      aria-label={socket.error ? `${label}: ${socket.error}` : label}
    >
      {label}
    </div>
  );
}
