import { fireEvent, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { contact, duplicateContact, importedContact, renderContactsWorkspace, resetContactsWorkspaceTest } from "./ContactsWorkspace.testUtils";

afterEach(resetContactsWorkspaceTest);

describe("ContactsWorkspace quality workflow", () => {
  it("shows a guided quality workspace with duplicate comparison", () => {
    renderContactsWorkspace("quality", [contact, importedContact, duplicateContact]);

    expect(screen.getByRole("region", { name: "Contact quality workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Section by" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Possible duplicates" })).toHaveTextContent("Example Contact");
    expect(screen.getByRole("region", { name: "Needs a better name" })).toHaveTextContent("imported.person@example.test");

    const duplicateGroup = screen.getByRole("region", { name: "Possible duplicates" });
    fireEvent.click(within(duplicateGroup).getByRole("button", { name: /Example Contact/i }));
    expect(screen.getByRole("complementary", { name: "Guided contact fixes" })).toHaveTextContent("Compare duplicate records");
    fireEvent.click(screen.getByRole("button", { name: "Compare duplicates" }));
    expect(screen.getByRole("dialog", { name: "Compare duplicate contacts" })).toHaveTextContent("Possible match");

    fireEvent.click(screen.getByRole("button", { name: "Close Compare duplicate contacts" }));
    fireEvent.click(screen.getByRole("button", { name: /imported.person@example.test/i }));
    expect(screen.getByLabelText("Purpose note")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Purpose note"), { target: { value: "Known from import review." } });
    expect(screen.getByLabelText("Purpose note")).toHaveValue("Known from import review.");
  });
});
