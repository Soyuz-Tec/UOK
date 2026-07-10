import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InlineTextEdit } from "./InlineTextEdit";

afterEach(cleanup);

describe("InlineTextEdit", () => {
  it("restores logical focus after a successful mutation", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<InlineTextEdit label="Task title" value="Before" onCommit={onCommit} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Task title" }));
    const input = screen.getByRole("textbox", { name: "Task title" });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "After" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith("After"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit Task title" })).toHaveFocus());
  });

  it("restores focus when an edit is cancelled", async () => {
    render(<InlineTextEdit label="Task title" value="Before" onCommit={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Task title" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit Task title" })).toHaveFocus());
  });
});
