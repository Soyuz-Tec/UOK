import { describe, expect, it } from "vitest";

import { contact } from "./ContactsWorkspace.fixtures";
import { contactDataFactCount, contactIdentitySignalCount, normalizedContactText } from "../../web/src/contactSignals";

describe("contact signals", () => {
  it("counts reusable data facts without treating the display name as a data fact", () => {
    expect(contactDataFactCount(contact)).toBe(4);
    expect(contactIdentitySignalCount(contact)).toBe(1);
  });

  it("normalizes contact text consistently for quality checks and profile models", () => {
    expect(normalizedContactText("  Example@UOK.Test ")).toBe("example@uok.test");
  });
});
