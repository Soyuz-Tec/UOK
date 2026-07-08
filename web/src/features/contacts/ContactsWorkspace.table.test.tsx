import { fireEvent, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { contact, renderContactsWorkspace, resetContactsWorkspaceTest } from "./ContactsWorkspace.testUtils";

afterEach(resetContactsWorkspaceTest);

describe("ContactsWorkspace table columns", () => {
  it("lets users add and remove optional table data points", () => {
    renderContactsWorkspace("table", [{ ...contact, website: "https://example.test", title: "Operations" }]);

    expect(screen.getByRole("columnheader", { name: /^Name/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Email/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Phone/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /^Website/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    const menu = screen.getByRole("group", { name: "Visible columns" });
    expect(within(menu).getByLabelText("Name")).toBeDisabled();

    fireEvent.click(within(menu).getByLabelText("Phone"));
    fireEvent.click(within(menu).getByLabelText("Website"));

    expect(screen.queryByRole("columnheader", { name: /^Phone/ })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Website/ })).toBeInTheDocument();
    expect(screen.getByText("https://example.test")).toBeInTheDocument();
  });
});
