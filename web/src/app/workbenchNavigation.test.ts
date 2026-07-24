import { describe, expect, it } from "vitest";

import { sectionFromSearch } from "./workbenchNavigation";

describe("workbench deep-link navigation", () => {
  it("opens registered module sections and rejects unknown views", () => {
    expect(sectionFromSearch("?view=communications&thread_id=thread-1")).toBe("communications");
    expect(sectionFromSearch("?view=contacts&party_id=party-1")).toBe("contacts");
    expect(sectionFromSearch("?view=unknown")).toBe("apps");
  });
});
