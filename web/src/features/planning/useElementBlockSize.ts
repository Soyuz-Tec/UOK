import { useLayoutEffect, useState } from "react";

export function useElementBlockSize<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [blockSize, setBlockSize] = useState(0);
  const [inlineSize, setInlineSize] = useState(0);

  useLayoutEffect(() => {
    if (!element) return undefined;

    const update = () => {
      const rect = element.getBoundingClientRect();
      setBlockSize(Math.round(rect.height));
      setInlineSize(Math.round(rect.width));
    };
    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, blockSize, inlineSize] as const;
}
