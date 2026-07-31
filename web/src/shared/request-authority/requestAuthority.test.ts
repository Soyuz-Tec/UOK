import { describe, expect, it, vi } from "vitest";

import { createRequestAuthority } from ".";

describe("request authority", () => {
  it("keeps only the newest ticket current in a lane", () => {
    const authority = createRequestAuthority();
    const first = authority.begin("records");
    const second = authority.begin("records");

    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(second.signal.aborted).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });

  it("keeps named lanes independent", () => {
    const authority = createRequestAuthority();
    const records = authority.begin("records");
    const options = authority.begin("options");
    const newerRecords = authority.begin("records");

    expect(records.isCurrent()).toBe(false);
    expect(newerRecords.isCurrent()).toBe(true);
    expect(options.signal.aborted).toBe(false);
    expect(options.isCurrent()).toBe(true);
  });

  it("invalidates every lane and defeats an A to B to A authority change", () => {
    const authority = createRequestAuthority();
    const firstA = authority.begin("records");
    const firstAEpoch = firstA.epoch;

    authority.invalidate();
    const b = authority.begin("records");
    authority.invalidate();
    const secondA = authority.begin("records");

    expect(firstA.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(true);
    expect(firstA.isCurrent()).toBe(false);
    expect(b.isCurrent()).toBe(false);
    expect(secondA.isCurrent()).toBe(true);
    expect(secondA.epoch).toBeGreaterThan(firstAEpoch);
  });

  it("rejects stale completion even when the underlying work cannot be aborted", async () => {
    const authority = createRequestAuthority();
    const stale = authority.begin("records");
    let complete!: (value: string) => void;
    const nonAbortableWork = new Promise<string>((resolve) => {
      complete = resolve;
    });
    const effect = vi.fn();

    authority.begin("records");
    complete("stale result");
    const result = await nonAbortableWork;
    stale.runIfCurrent(() => effect(result));

    expect(effect).not.toHaveBeenCalled();
  });

  it("runs a current guarded callback only once", () => {
    const authority = createRequestAuthority();
    const ticket = authority.begin("records");
    const callback = vi.fn((status: number) => `handled ${status}`);
    const handleOnce = ticket.onceIfCurrent(callback);

    expect(handleOnce(401)).toBe("handled 401");
    expect(handleOnce(401)).toBeUndefined();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("turns a stale guarded callback into a no-op", () => {
    const authority = createRequestAuthority();
    const ticket = authority.begin("records");
    const callback = vi.fn();
    const handleOnce = ticket.onceIfCurrent(callback);

    authority.begin("records");
    handleOnce();

    expect(callback).not.toHaveBeenCalled();
  });

  it("releases a ticket and disposes every remaining lane", () => {
    const authority = createRequestAuthority();
    const released = authority.begin("records");
    const remaining = authority.begin("options");

    released.release();
    expect(released.isCurrent()).toBe(false);
    expect(released.signal.aborted).toBe(false);
    expect(remaining.isCurrent()).toBe(true);

    const disposedEpoch = authority.dispose();
    const afterDispose = authority.begin("records");

    expect(remaining.signal.aborted).toBe(true);
    expect(remaining.isCurrent()).toBe(false);
    expect(authority.epoch).toBe(disposedEpoch);
    expect(authority.isCurrentEpoch(disposedEpoch)).toBe(false);
    expect(afterDispose.signal.aborted).toBe(true);
    expect(afterDispose.isCurrent()).toBe(false);
  });

  it("supports committed-state freshness checks with authority epoch stamps", () => {
    const authority = createRequestAuthority();
    const ticket = authority.begin("records");
    const committedState = { value: "ready", authorityEpoch: ticket.epoch };

    expect(authority.isCurrentEpoch(committedState.authorityEpoch)).toBe(true);

    authority.invalidate();

    expect(authority.isCurrentEpoch(committedState.authorityEpoch)).toBe(false);
    expect(authority.epoch).toBeGreaterThan(committedState.authorityEpoch);
  });
});
