export class LatestRequestGuard {
  private generation = 0;
  private controller: AbortController | null = null;

  begin() {
    this.cancel();
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    return {
      signal: controller.signal,
      isCurrent: () => this.generation === generation && !controller.signal.aborted,
      release: () => {
        if (this.generation === generation && this.controller === controller) this.controller = null;
      },
    };
  }

  cancel() {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
  }
}
