import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { UokLocalizationProvider } from "../localization/UokLocalization";
import { WorkspaceCommandBar } from "./WorkspaceCommandBar";

describe("WorkspaceCommandBar", () => {
  it("renders at most three labelled groups in stable slot order", () => {
    render(
      <WorkspaceCommandBar
        label="Contacts controls"
        className="contacts-command-bar"
        query={<span>Query</span>}
        context={<span>Scope</span>}
        pagination={<span>Pagination</span>}
        view={<span>View</span>}
        fields={<span>Fields</span>}
        secondaryActions={<span>Refresh</span>}
        primaryAction={<button type="button">New contact</button>}
      />
    );

    const commandBar = screen.getByRole("region", { name: "Contacts controls" });
    const groups = within(commandBar).getAllByRole("group");

    expect(commandBar).toHaveClass("workspace-command-bar", "contacts-command-bar");
    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual([
      "Contacts controls query",
      "Contacts controls context",
      "Contacts controls actions",
    ]);
    expect(groups[0]).toHaveTextContent("Query");
    expect(groups[1]).toHaveTextContent("ScopePagination");
    expect(groups[2]).toHaveTextContent("ViewFieldsRefreshNew contact");
    expect(within(commandBar).queryByRole("toolbar")).not.toBeInTheDocument();
  });

  it("omits empty groups while preserving the trailing primary action", () => {
    render(
      <WorkspaceCommandBar
        label="Calendar controls"
        primaryAction={<button type="button">New event</button>}
      />
    );

    const commandBar = screen.getByRole("region", { name: "Calendar controls" });
    const groups = within(commandBar).getAllByRole("group");

    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveAccessibleName("Calendar controls actions");
    expect(within(groups[0]).getByRole("button", { name: "New event" })).toBeInTheDocument();
  });

  it("localizes shared group names for RTL workspaces", () => {
    render(<UokLocalizationProvider locale="ar"><WorkspaceCommandBar label="جهات الاتصال" query={<span>بحث</span>} primaryAction={<button type="button">جديد</button>} /></UokLocalizationProvider>);

    const commandBar = screen.getByRole("region", { name: "جهات الاتصال" });
    expect(within(commandBar).getByRole("group", { name: "جهات الاتصال البحث" })).toBeInTheDocument();
    expect(within(commandBar).getByRole("group", { name: "جهات الاتصال الإجراءات" })).toBeInTheDocument();
  });
});
