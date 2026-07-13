import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { CalendarWorkspaceStatus } from "../../web/src/CalendarWorkspaceStatus";

describe("CalendarWorkspaceStatus", () => {
  afterEach(cleanup);

  it("announces grammatically correct singular counts", () => {
    render(<CalendarWorkspaceStatus eventCount={1} busyCount={1} message="Loaded." error="" />);

    expect(screen.getByRole("status")).toHaveTextContent("1 event. 1 busy block. Loaded.");
  });

  it("localizes counts and numerals for Arabic", () => {
    render(
      <UokLocalizationProvider locale="ar">
        <CalendarWorkspaceStatus eventCount={2} busyCount={3} message="" error="" />
      </UokLocalizationProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("٢ أحداث. ٣ فترات مشغولة.");
  });
});
