import type { DragEventHandler, ReactNode } from "react";

interface DashboardLayoutProps {
  sidebar: ReactNode;
  tabs: ReactNode;
  browser: ReactNode;
  overlays: ReactNode;
  onDragEnter?: DragEventHandler<HTMLDivElement>;
  onDragLeave?: DragEventHandler<HTMLDivElement>;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
}

export default function DashboardLayout({
  sidebar,
  tabs,
  browser,
  overlays,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: DashboardLayoutProps) {
  return (
    <div
      className="flex h-screen overflow-hidden bg-app"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {sidebar}
      <main className="flex min-h-0 min-w-0 flex-1 bg-surface">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface">
          {tabs}
          {browser}
        </div>
      </main>
      {overlays}
    </div>
  );
}
