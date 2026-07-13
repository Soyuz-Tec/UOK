import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { PlanningGanttSplitHandle } from "../../web/src/PlanningGanttSplitHandle";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PlanningGanttSplitHandle", () => {
  it("exposes an adjustable separator and supports bounded keyboard changes", () => {
    const onChange = vi.fn();
    render(<SplitHarness value={42} onChange={onChange} />);

    const separator = screen.getByRole("separator", { name: "Resize task grid and timeline" });
    expect(separator).toHaveAttribute("aria-valuemin", "24");
    expect(separator).toHaveAttribute("aria-valuemax", "68");
    expect(separator).toHaveAttribute("aria-valuenow", "42");
    expect(separator).toHaveAttribute("aria-valuetext", "42% task grid, 58% timeline");

    fireEvent.keyDown(separator, { key: "ArrowRight" });
    fireEvent.keyDown(separator, { key: "Home" });
    fireEvent.doubleClick(separator);

    expect(onChange).toHaveBeenNthCalledWith(1, 43);
    expect(onChange).toHaveBeenNthCalledWith(2, 24);
    expect(onChange).toHaveBeenNthCalledWith(3, 42);
  });

  it("reports and uses the physical split bounds when pane minimums constrain the percentage", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 500, height: 500, left: 0, right: 1000, top: 0, width: 1000, x: 0, y: 0, toJSON: () => ({}),
    });
    let notifyResize: () => void = () => {};
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this as unknown as ResizeObserver);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    const onChange = vi.fn();
    const view = render(<SplitHarness value={24} onChange={onChange} />);
    act(() => notifyResize());

    const separator = view.getByRole("separator", { name: "Resize task grid and timeline" });
    expect(separator).toHaveAttribute("aria-valuemin", "34");
    expect(separator).toHaveAttribute("aria-valuemax", "58");
    expect(separator).toHaveAttribute("aria-valuenow", "34");
    expect(separator).toHaveAttribute("aria-valuetext", "34% task grid, 66% timeline");

    fireEvent.keyDown(separator, { key: "ArrowRight" });
    fireEvent.keyDown(separator, { key: "End" });
    fireEvent.doubleClick(separator);

    expect(onChange).toHaveBeenNthCalledWith(1, 35);
    expect(onChange).toHaveBeenNthCalledWith(2, 58);
    expect(onChange).toHaveBeenNthCalledWith(3, 42);
  });

  it("exposes the splitter instructions and formatted value in Arabic", () => {
    render(
      <UokLocalizationProvider locale="ar">
        <SplitHarness value={42} onChange={vi.fn()} />
      </UokLocalizationProvider>,
    );

    const separator = screen.getByRole("separator", { name: "تغيير حجم شبكة المهام والخط الزمني" });
    expect(separator).toHaveAttribute("aria-valuetext", "شبكة المهام بنسبة ٤٢٪، والخط الزمني بنسبة ٥٨٪");
    expect(separator).toHaveAttribute("title", "اسحب لتغيير الحجم. استخدم مفاتيح الأسهم أو Home أو End، وانقر نقرا مزدوجا لإعادة الضبط.");
  });
});

function SplitHarness({ onChange, value }: { onChange: (value: number) => void; value: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  return <div ref={containerRef}><PlanningGanttSplitHandle containerRef={containerRef} value={value} onChange={onChange} /></div>;
}
