import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { ExpandableControlPanel } from "./ExpandableControlPanel";

describe("ExpandableControlPanel", () => {
  it("focuses an explicitly preferred control when the panel opens", async () => {
    render(
      <ExpandableControlPanel
        label="Date controls"
        triggerLabel="Open date controls"
        triggerSummary="Date controls"
        initialFocusSelector="[data-preferred='true']"
      >
        <button type="button">First control</button>
        <button type="button" data-preferred="true">Preferred control</button>
      </ExpandableControlPanel>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open date controls" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Preferred control" })).toHaveFocus());
  });
});
