import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { AsyncState } from "./AsyncState";

describe("AsyncState", () => {
  it("announces loading without presenting an error", () => {
    render(<AsyncState kind="loading" title="Loading records" message="Current filters are being applied." />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces errors and exposes a retry command", () => {
    const retry = vi.fn();
    render(
      <AsyncState
        kind="error"
        title="Records could not load"
        message="The service did not respond."
        onRetry={retry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("The service did not respond.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
