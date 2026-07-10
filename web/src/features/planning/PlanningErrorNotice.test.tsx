import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { PlanningErrorNotice } from "./PlanningErrorNotice";

describe("PlanningErrorNotice", () => {
  it("announces repair, field, revision, and audit reference for a structured error", () => {
    render(<PlanningErrorNotice status={{
      status: "error",
      http_status: 400,
      code: "planning_validation_failed",
      message: "progress must be between 0 and 100",
      field: "progress",
      object_ids: ["project-1", "task-1"],
      repair: "Set progress to a value from 0 to 100.",
      current_revision: 7,
      correlation_id: "command-correlation-1",
    }} />);

    const alert = screen.getByRole("alert", { name: "Planning change failed" });
    expect(alert).toHaveFocus();
    expect(alert).toHaveTextContent("progress must be between 0 and 100");
    expect(alert).toHaveTextContent("Set progress to a value from 0 to 100.");
    expect(alert).toHaveTextContent("Field: progress");
    expect(alert).toHaveTextContent("Current revision: 7");
    expect(alert).toHaveTextContent("Audit reference: command-correlation-1");
  });

  it("does not render for non-domain status", () => {
    const { container } = render(<PlanningErrorNotice status={{ status: "ready" }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
