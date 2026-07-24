import { useEffect, useRef, type ReactNode } from "react";

export function ContactFormDisclosure({
  title,
  summary,
  defaultOpen = false,
  children
}: {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (defaultOpen && detailsRef.current) {
      detailsRef.current.open = true;
    }
  }, [defaultOpen]);

  return (
    <details className="contact-form-disclosure" ref={detailsRef}>
      <summary>
        <strong>{title}</strong>
        <span>{summary}</span>
      </summary>
      <div className="form-field-grid">
        {children}
      </div>
    </details>
  );
}
