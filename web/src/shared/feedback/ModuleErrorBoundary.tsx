import { Component, type ErrorInfo, type ReactNode } from "react";

import { AsyncState } from "./AsyncState";

type ModuleErrorBoundaryProps = {
  active: boolean;
  children: ReactNode;
  moduleLabel: string;
  onError?: (error: Error, details: ErrorInfo) => void;
};

type ModuleErrorBoundaryState = {
  error: Error | null;
};

export class ModuleErrorBoundary extends Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  state: ModuleErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, details: ErrorInfo) {
    this.props.onError?.(error, details);
  }

  componentDidUpdate(previous: ModuleErrorBoundaryProps) {
    if (!previous.active && this.props.active && this.state.error) {
      this.setState({ error: null });
    }
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section
        className="module-error-boundary"
        aria-label={`${this.props.moduleLabel} unavailable`}
      >
        <AsyncState
          kind="error"
          title={`${this.props.moduleLabel} could not open`}
          message="This module stopped rendering. The rest of the workspace is still available."
          onRetry={this.retry}
        />
      </section>
    );
  }
}
