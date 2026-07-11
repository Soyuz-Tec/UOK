import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { contact, duplicateContact, importedContact, renderContactsWorkspace, resetContactsWorkspaceTest } from "./ContactsWorkspace.testUtils";

afterEach(resetContactsWorkspaceTest);

describe("ContactsWorkspace search and paging", () => {
  it("unifies search filters grouping and saved searches", async () => {
    renderContactsWorkspace("table", [contact, importedContact, duplicateContact]);

    expect(screen.queryByRole("button", { name: "Apply Working view" })).not.toBeInTheDocument();
    expect(searchOptionsTrigger()).toHaveTextContent("Active records");
    openSearchOptions();
    expect(screen.getByRole("button", { name: "Save search" })).toBeDisabled();
    expect(screen.getByRole("dialog", { name: "Search options" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search contacts" }), { target: { value: "Example" } });
    expect(screen.getByRole("region", { name: "Search options" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "all" } });
    fireEvent.click(screen.getByRole("button", { name: "Source" }));

    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Search: Example");
    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Status: All statuses");
    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Section: Source");
    expect(screen.getByText("Source: Contacts")).toBeInTheDocument();
    expect(searchOptionsTrigger()).toHaveTextContent("3 refinements");
    expect(searchOptionsTrigger()).toHaveAttribute("aria-expanded", "true");

    fireEvent.change(screen.getByLabelText("Saved search name"), { target: { value: "Source review" } });
    fireEvent.click(screen.getByRole("button", { name: "Save search" }));
    expect(screen.getByRole("button", { name: "Apply Source review" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await expectSearchOptionsClosedWithFocus();

    openSearchOptions();
    fireEvent.keyDown(document, { key: "Escape" });
    await expectSearchOptionsClosedWithFocus();

    openSearchOptions();
    fireEvent.mouseDown(document.body);
    await expectSearchOptionsClosedWithFocus();

    openSearchOptions();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByRole("textbox", { name: "Search contacts" })).toHaveValue("");
    expect(screen.queryByText("Source: Contacts")).not.toBeInTheDocument();
    expect(searchOptionsTrigger()).toHaveTextContent("Active records");
    expect(searchOptionsTrigger()).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Apply Source review" }));
    expect(screen.getByRole("textbox", { name: "Search contacts" })).toHaveValue("Example");
    expect(screen.getByText("Source: Contacts")).toBeInTheDocument();
    expect(searchOptionsTrigger()).toHaveTextContent("3 refinements");
    expect(searchOptionsTrigger()).toHaveAttribute("aria-expanded", "false");
  }, 10_000);

  it("shows page and sort controls without leaving the contacts workspace", () => {
    renderContactsWorkspace("table", [contact, importedContact, duplicateContact]);
    const commandBar = screen.getByLabelText("Contacts controls");
    expect(within(commandBar).getByRole("group", { name: "Contacts controls query" })).toBeInTheDocument();
    expect(within(commandBar).getByRole("group", { name: "Contacts controls context" })).toBeInTheDocument();
    expect(within(commandBar).getByRole("group", { name: "Contacts controls actions" })).toBeInTheDocument();
    expect(within(commandBar).getAllByRole("button", { name: "New contact" })).toHaveLength(1);
    openSearchOptions();

    const searchOptions = screen.getByRole("region", { name: "Search options" });
    expect(within(searchOptions).getByRole("region", { name: "Sort" })).toBeInTheDocument();
    expect(within(searchOptions).getByLabelText("Contact sort field")).toHaveValue("updated_at");
    expect(within(searchOptions).getByRole("button", { name: "Sort descending" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeDisabled();
    expect(screen.getByLabelText("Contact paging")).toBeInTheDocument();
    expect(screen.getByLabelText("Contacts page size")).toHaveValue("25");
    expect(screen.getByText("1-3 / 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Showing records 1 through 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.change(within(searchOptions).getByLabelText("Contact sort field"), { target: { value: "display_name" } });
    expect(within(searchOptions).getByLabelText("Contact sort field")).toHaveValue("display_name");
    expect(searchOptionsTrigger()).toHaveTextContent("Sort: Name descending");
    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Sort: Name descending");

    fireEvent.click(within(searchOptions).getByRole("button", { name: "Sort descending" }));
    expect(within(searchOptions).getByRole("button", { name: "Sort ascending" })).toBeInTheDocument();
    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Sort: Name ascending");

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(within(searchOptions).getByLabelText("Contact sort field")).toHaveValue("updated_at");
    expect(within(searchOptions).getByRole("button", { name: "Sort descending" })).toBeInTheDocument();
    expect(searchOptionsTrigger()).toHaveTextContent("Active records");
  });

  it("filters by a persistent contact group from the unified search surface", () => {
    renderContactsWorkspace("table", [contact, importedContact, duplicateContact]);
    openSearchOptions();

    fireEvent.change(screen.getByLabelText("Group filter"), { target: { value: "group-1" } });

    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Group: Important contacts");
  });

  it("applies pinned Contacts saved views for common cleanup workflows", () => {
    renderContactsWorkspace("table", [contact, importedContact, duplicateContact]);
    openSearchOptions();

    for (const viewName of ["All records", "Needs review", "Organizations", "People", "No company", "Imported from Gmail", "Duplicate risk", "Recently updated"]) {
      expect(screen.getByRole("button", { name: `Apply ${viewName}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Delete No company" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply No company" }));
    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Type: Person");
    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Quality: No company");
    expect(searchOptionsTrigger()).toHaveAttribute("aria-expanded", "false");

    openSearchOptions();
    fireEvent.click(screen.getByRole("button", { name: "Apply Imported from Gmail" }));
    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Source: Gmail");
    expect(screen.queryByText("Quality: No company")).not.toBeInTheDocument();

    openSearchOptions();
    fireEvent.click(screen.getByRole("button", { name: "Apply Duplicate risk" }));
    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Quality: Duplicate risk");
  });
});

function searchOptionsTrigger() {
  return screen.getByRole("button", { name: /^Search options:/ });
}

function openSearchOptions() {
  const trigger = searchOptionsTrigger();
  if (trigger.getAttribute("aria-expanded") !== "true") fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  return trigger;
}

async function expectSearchOptionsClosedWithFocus() {
  await waitFor(() => {
    const trigger = searchOptionsTrigger();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });
}
