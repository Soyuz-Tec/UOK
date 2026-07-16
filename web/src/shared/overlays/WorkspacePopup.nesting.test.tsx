import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { WorkspacePopup } from "./WorkspacePopup";

describe("WorkspacePopup nesting", () => {
  it("lets only the topmost nested popup handle Escape and keyboard focus", async () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();

    function NestedPopupHarness() {
      const [innerOpen, setInnerOpen] = useState(false);
      return (
        <WorkspacePopup open label="Outer editor" onClose={closeOuter}>
          <button type="button" onClick={() => setInnerOpen(true)}>Open confirmation</button>
          <button type="button">Outer last action</button>
          <WorkspacePopup
            open={innerOpen}
            label="Nested confirmation"
            onClose={() => {
              closeInner();
              setInnerOpen(false);
            }}
          >
            <button type="button">Nested first action</button>
            <button type="button">Nested last action</button>
          </WorkspacePopup>
        </WorkspacePopup>
      );
    }

    render(<NestedPopupHarness />);
    const openConfirmation = screen.getByRole("button", { name: "Open confirmation" });
    openConfirmation.focus();
    fireEvent.click(openConfirmation);

    const nestedDialog = await screen.findByRole("dialog", { name: "Nested confirmation" });
    const nestedClose = screen.getByRole("button", { name: "Close Nested confirmation" });
    const nestedLast = screen.getByRole("button", { name: "Nested last action" });
    expect(nestedDialog).toBeInTheDocument();
    nestedLast.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(nestedClose).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nested confirmation" })).not.toBeInTheDocument());
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Outer editor" })).toBeInTheDocument();
    expect(openConfirmation).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeOuter).toHaveBeenCalledTimes(1);
  });
});
