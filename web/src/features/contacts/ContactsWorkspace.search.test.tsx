import { fireEvent, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { contact, duplicateContact, importedContact, renderContactsWorkspace, resetContactsWorkspaceTest } from "./ContactsWorkspace.testUtils";

afterEach(resetContactsWorkspaceTest);

describe("ContactsWorkspace search and paging", () => {
  it("unifies search filters grouping and saved searches", () => {
    const { container } = renderContactsWorkspace("table", [contact, importedContact, duplicateContact]);
    const menu = container.querySelector(".search-workspace-menu") as HTMLDetailsElement;

    expect(screen.queryByRole("button", { name: "Apply Working view" })).not.toBeInTheDocument();
    expect(container.querySelector(".search-workspace-menu summary span")).toHaveTextContent("Active records");
    expect(screen.getByRole("button", { name: "Save search" })).toBeDisabled();
    expect(menu).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search contacts" }), { target: { value: "Example" } });
    expect(screen.getByRole("region", { name: "Search options" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "all" } });
    menu.open = true;
    fireEvent.click(screen.getByRole("button", { name: "Source" }));

    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Search: Example");
    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Status: All statuses");
    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Section: Source");
    expect(screen.getByText("Source: Contacts")).toBeInTheDocument();
    expect(container.querySelector(".search-workspace-menu summary span")).toHaveTextContent("3 refinements");
    expect(menu.open).toBe(false);

    fireEvent.change(screen.getByLabelText("Saved search name"), { target: { value: "Source review" } });
    fireEvent.click(screen.getByRole("button", { name: "Save search" }));
    expect(screen.getByRole("button", { name: "Apply Source review" })).toBeInTheDocument();

    menu.open = true;
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(menu.open).toBe(false);

    menu.open = true;
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu.open).toBe(false);

    menu.open = true;
    fireEvent.mouseDown(document.body);
    expect(menu.open).toBe(false);

    menu.open = true;
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByRole("textbox", { name: "Search contacts" })).toHaveValue("");
    expect(screen.queryByText("Source: Contacts")).not.toBeInTheDocument();
    expect(container.querySelector(".search-workspace-menu summary span")).toHaveTextContent("Active records");
    expect(menu.open).toBe(false);

    menu.open = true;
    fireEvent.click(screen.getByRole("button", { name: "Apply Source review" }));
    expect(screen.getByRole("textbox", { name: "Search contacts" })).toHaveValue("Example");
    expect(screen.getByText("Source: Contacts")).toBeInTheDocument();
    expect(container.querySelector(".search-workspace-menu summary span")).toHaveTextContent("3 refinements");
    expect(menu.open).toBe(false);
  });

  it("shows page and sort controls without leaving the contacts workspace", () => {
    const { container } = renderContactsWorkspace("table", [contact, importedContact, duplicateContact]);

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
    expect(container.querySelector(".search-workspace-menu summary span")).toHaveTextContent("Sort: Name descending");
    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Sort: Name descending");

    fireEvent.click(within(searchOptions).getByRole("button", { name: "Sort descending" }));
    expect(within(searchOptions).getByRole("button", { name: "Sort ascending" })).toBeInTheDocument();
    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Sort: Name ascending");

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(within(searchOptions).getByLabelText("Contact sort field")).toHaveValue("updated_at");
    expect(within(searchOptions).getByRole("button", { name: "Sort descending" })).toBeInTheDocument();
    expect(container.querySelector(".search-workspace-menu summary span")).toHaveTextContent("Active records");
  });

  it("filters by a persistent contact group from the unified search surface", () => {
    renderContactsWorkspace("table", [contact, importedContact, duplicateContact]);

    fireEvent.change(screen.getByLabelText("Group filter"), { target: { value: "group-1" } });

    expect(screen.getByLabelText("Active search refinements")).toHaveTextContent("Group: Important contacts");
  });
});
