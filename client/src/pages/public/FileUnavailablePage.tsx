import { FileQuestion } from "lucide-react";

export default function FileUnavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-app p-6 text-text">
      <section className="w-[min(390px,100%)] text-center">
        <div className="mx-auto mb-4.5 grid size-11.5 place-items-center rounded-xl border border-border-subtle bg-surface text-muted-strong shadow-e1 [&>svg]:size-5.25">
          <FileQuestion aria-hidden="true" />
        </div>
        <h1 className="m-0 text-[clamp(22px,5vw,28px)] font-medium tracking-[-0.035em] text-text">
          File unavailable
        </h1>
        <p className="mx-auto mt-2.25 text-13 leading-[1.55] text-muted">
          This file does not exist or is not publicly available.
        </p>
      </section>
    </main>
  );
}
