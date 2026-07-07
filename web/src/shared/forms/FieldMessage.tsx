import type { ReactNode } from "react";

export function FieldMessage({ id, children }: { id: string; children: ReactNode }) {
  return <p id={id} className="field-message">{children}</p>;
}
