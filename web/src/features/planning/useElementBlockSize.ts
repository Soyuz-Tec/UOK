import { useLayoutEffect, useRef, useState } from "react";

export function useElementBlockSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [blockSize, setBlockSize] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => {
      setBlockSize(Math.round(element.getBoundingClientRect().height));
    };
    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, blockSize] as const;
}
