import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { businessContactWithoutCompany, contact, duplicateContact, importedContact, renderContactsWorkspace, resetContactsWorkspaceTest } from "./ContactsWorkspace.testUtils";

afterEach(resetContactsWorkspaceTest);

describe("ContactsWorkspace quality workflow", () => {
  it("shows a guided quality workspace with duplicate comparison", async () => {
    const onMergeDuplicate = vi.fn().mockResolvedValue(undefined);
    renderContactsWorkspace("quality", [contact, importedContact, duplicateContact], { onMergeDuplicate });

    expect(screen.getByRole("region", { name: "Contact quality workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Section by" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Possible duplicates" })).toHaveTextContent("Example Contact");
    expect(screen.getByRole("region", { name: "Email-only contacts" })).toHaveTextContent("imported.person@example.test");

    const duplicateGroup = screen.getByRole("region", { name: "Possible duplicates" });
    fireEvent.click(within(duplicateGroup).getByRole("button", { name: /Example Contact/i }));
    expect(screen.getByRole("complementary", { name: "Guided contact fixes" })).toHaveTextContent("Compare duplicate records");
    fireEvent.click(screen.getByRole("button", { name: "Compare duplicates" }));
    expect(screen.getByRole("dialog", { name: "Compare duplicate contacts" })).toHaveTextContent("Possible match");
    expect(screen.getByLabelText("Field choices for Example Contact")).toBeInTheDocument();
    fireEvent.click(within(screen.getByLabelText("Field choices for Example Contact")).getByRole("button", { name: "Use match Phone" }));
    fireEvent.click(screen.getByRole("button", { name: "Merge into selected" }));
    expect(onMergeDuplicate).toHaveBeenCalledWith("contact-3", "contact-1", { phone: "duplicate" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Compare duplicate contacts" })).not.toBeInTheDocument());

    fireEvent.click(await screen.findByRole("button", { name: /imported.person@example.test/i }));
    expect(screen.getByLabelText("Purpose note")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Purpose note"), { target: { value: "Known from import review." } });
    expect(screen.getByLabelText("Purpose note")).toHaveValue("Known from import review.");
  });

  it("separates business contacts that need company context", () => {
    renderContactsWorkspace("quality", [businessContactWithoutCompany]);

    const group = screen.getByRole("region", { name: "Missing company" });
    expect(group).toHaveTextContent("Mina Supplier");
    fireEvent.click(within(group).getByRole("button", { name: /Mina Supplier/i }));
    expect(screen.getByRole("complementary", { name: "Guided contact fixes" })).toHaveTextContent("Add company or organization");
  });
});
