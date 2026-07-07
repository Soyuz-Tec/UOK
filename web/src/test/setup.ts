import { beforeEach, vi } from "vitest";

import { createMemoryStorage } from "../shared/storage";

beforeEach(() => {
  if (typeof globalThis.localStorage === "undefined") {
    vi.stubGlobal("localStorage", createMemoryStorage());
  }

  if (typeof globalThis.sessionStorage === "undefined") {
    vi.stubGlobal("sessionStorage", createMemoryStorage());
  }
});
