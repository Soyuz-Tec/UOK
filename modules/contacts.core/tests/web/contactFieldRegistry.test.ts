import { describe, expect, it } from "vitest";

import { contact } from "./ContactsWorkspace.fixtures";
import { contactFieldLabel, contactFieldValue, contactVisibilityOptions } from "../../web/src/contactFieldRegistry";

describe("contact field registry", () => {
  it("provides labels and values from one registry for list and table surfaces", () => {
    expect(contactFieldLabel("email")).toBe("Email");
    expect(contactFieldValue(contact, "email", "-")).toBe("example@uok.test");
    expect(contactFieldValue({ ...contact, email: undefined }, "email", "-")).toBe("-");
  });

  it("builds visibility options from the same field definitions", () => {
    expect(contactVisibilityOptions(["name", "email", "website"])).toEqual([
      { id: "name", label: "Name", defaultVisible: undefined, locked: true },
      { id: "email", label: "Email", defaultVisible: undefined, locked: undefined },
      { id: "website", label: "Website", defaultVisible: false, locked: undefined }
    ]);
  });
});
