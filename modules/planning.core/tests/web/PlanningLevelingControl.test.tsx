import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningLevelingControl } from "../../web/src/PlanningLevelingControl";
import { levelingSuccessStatus } from "../../web/src/planningMutationIntents";

afterEach(cleanup);

describe("PlanningLevelingControl", () => {
  it("submits the configured bounded working-day horizon", () => {
    const onLevel = vi.fn();
    render(<PlanningLevelingControl busy={false} disabled={false} onLevel={onLevel} />);

    fireEvent.change(screen.getByLabelText("Leveling horizon working days"), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Level" }));

    expect(onLevel).toHaveBeenCalledWith(45);
  });

  it("disables the command outside the server-supported range", () => {
    render(<PlanningLevelingControl busy={false} disabled={false} onLevel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Leveling horizon working days"), { target: { value: "0" } });
    expect((screen.getByRole("button", { name: "Level" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the full explainable result for the accessible status panel", () => {
    const leveling = { outcome: "infeasible", reasons: [{ code: "horizon_exhausted" }] };
    expect(levelingSuccessStatus({ leveling })).toEqual({ leveling });
  });
});
