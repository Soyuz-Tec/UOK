export function browserStorage(kind: "local" | "session"): Storage | null {
  const key = kind === "local" ? "localStorage" : "sessionStorage";
  try {
    const storage = globalThis[key];
    return storage && typeof storage.getItem === "function" ? storage : null;
  } catch {
    return null;
  }
}

export function readStorageString(kind: "local" | "session", key: string, fallback = "") {
  const storage = browserStorage(kind);
  if (!storage) return fallback;
  try {
    return storage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStorageString(kind: "local" | "session", key: string, value: string) {
  const storage = browserStorage(kind);
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // UI preferences must not block normal workspace activity.
  }
}

export function removeStorageItem(kind: "local" | "session", key: string) {
  const storage = browserStorage(kind);
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Storage cleanup is best-effort.
  }
}

export function readStorageJson<T>(
  kind: "local" | "session",
  key: string,
  fallback: T,
  isValid?: (value: unknown) => value is T
): T {
  const storage = browserStorage(kind);
  if (!storage) return fallback;
  try {
    const rawValue = storage.getItem(key);
    const parsed = rawValue ? JSON.parse(rawValue) : fallback;
    return !isValid || isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorageJson(kind: "local" | "session", key: string, value: unknown): void {
  const storage = browserStorage(kind);
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Stored UI state is a convenience layer; the app must keep working.
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
