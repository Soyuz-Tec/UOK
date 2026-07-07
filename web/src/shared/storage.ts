export function browserStorage(kind: "local" | "session"): Storage | null {
  const key = kind === "local" ? "localStorage" : "sessionStorage";
  try {
    const storage = globalThis[key];
    return storage && typeof storage.getItem === "function" ? storage : null;
  } catch {
    return null;
  }
}

export function createMemoryStorage(): Storage {
  let entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries = new Map<string, string>();
    },
    getItem(key: string) {
      return entries.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key: string) {
      entries.delete(key);
    },
    setItem(key: string, value: string) {
      entries.set(key, value);
    }
  };
}
