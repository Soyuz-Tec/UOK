import type { ReactNode } from "react";

export function Pane({ title, description, children, wide = false }: {
  title?: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const labelId = `${(title || description).replace(/\s+/g, "-").toLowerCase()}-title`;
  return (
    <section className={`pane ${wide ? "wide" : ""}`} aria-labelledby={title ? labelId : undefined} aria-label={title ? undefined : description}>
      {title && (
        <header className="pane-header">
          <div>
            <h2 id={labelId}>{title}</h2>
          </div>
        </header>
      )}
      <div className="pane-body">{children}</div>
    </section>
  );
}
