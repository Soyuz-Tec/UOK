export type RequestAuthorityEpoch = number;

export interface RequestAuthorityTicket {
  /** The authority generation captured when this request began. */
  readonly epoch: RequestAuthorityEpoch;
  /** Cooperative cancellation for work that supports AbortSignal. */
  readonly signal: AbortSignal;
  /** True only while this ticket is the latest request in its lane and its authority is valid. */
  isCurrent(): boolean;
  /** Runs an effect only while this ticket still owns its lane and authority generation. */
  runIfCurrent<Result>(effect: () => Result): Result | undefined;
  /**
   * Wraps a callback so it can run at most once, and only while this ticket is current.
   *
   * This is useful for side effects reached through more than one completion path.
   */
  onceIfCurrent<Arguments extends unknown[], Result>(
    callback: (...arguments_: Arguments) => Result
  ): (...arguments_: Arguments) => Result | undefined;
  /** Stops this ticket from owning its lane without treating cancellation as freshness proof. */
  release(): void;
}

export interface RequestAuthority {
  /** The current authority generation. It advances whenever all outstanding work is invalidated. */
  readonly epoch: RequestAuthorityEpoch;
  /** Starts the latest request in a named lane and cooperatively aborts the lane's prior request. */
  begin(lane: string): RequestAuthorityTicket;
  /** Revokes every outstanding ticket and advances the authority generation. */
  invalidate(): RequestAuthorityEpoch;
  /** Checks a generation stamp independently of any request lane. */
  isCurrentEpoch(epoch: RequestAuthorityEpoch): boolean;
  /** Permanently revokes the authority, for example during owner unmount. */
  dispose(): RequestAuthorityEpoch;
}

interface ActiveTicket {
  readonly controller: AbortController;
  readonly epoch: RequestAuthorityEpoch;
  released: boolean;
}

export function createRequestAuthority(): RequestAuthority {
  let epoch: RequestAuthorityEpoch = 0;
  let disposed = false;
  const lanes = new Map<string, ActiveTicket>();

  const abortTickets = (tickets: Iterable<ActiveTicket>) => {
    for (const ticket of tickets) {
      ticket.controller.abort();
    }
  };

  const invalidateActiveTickets = () => {
    epoch += 1;
    const activeTickets = Array.from(lanes.values());
    lanes.clear();
    abortTickets(activeTickets);
    return epoch;
  };

  const authority: RequestAuthority = {
    get epoch() {
      return epoch;
    },

    begin(lane) {
      if (!lane.trim()) {
        throw new Error("A request authority lane must have a name.");
      }

      const controller = new AbortController();
      const activeTicket: ActiveTicket = {
        controller,
        epoch,
        released: disposed
      };
      const priorTicket = lanes.get(lane);

      if (!disposed) {
        // Publish the successor before aborting so abort listeners cannot commit through the old ticket.
        lanes.set(lane, activeTicket);
      } else {
        controller.abort();
      }
      priorTicket?.controller.abort();

      const isCurrent = () =>
        !disposed &&
        !activeTicket.released &&
        activeTicket.epoch === epoch &&
        lanes.get(lane) === activeTicket;

      return {
        epoch: activeTicket.epoch,
        signal: controller.signal,
        isCurrent,
        runIfCurrent<Result>(effect: () => Result) {
          return isCurrent() ? effect() : undefined;
        },
        onceIfCurrent<Arguments extends unknown[], Result>(
          callback: (...arguments_: Arguments) => Result
        ) {
          let used = false;
          return (...arguments_: Arguments) => {
            if (used || !isCurrent()) {
              return undefined;
            }
            used = true;
            return callback(...arguments_);
          };
        },
        release() {
          if (activeTicket.released) {
            return;
          }
          activeTicket.released = true;
          if (lanes.get(lane) === activeTicket) {
            lanes.delete(lane);
          }
        }
      };
    },

    invalidate() {
      if (disposed) {
        return epoch;
      }
      return invalidateActiveTickets();
    },

    isCurrentEpoch(candidateEpoch) {
      return !disposed && candidateEpoch === epoch;
    },

    dispose() {
      if (disposed) {
        return epoch;
      }
      disposed = true;
      return invalidateActiveTickets();
    }
  };

  return authority;
}
