import { Component, type ErrorInfo, type ReactNode } from "react";
import { ArrowClockwise, Warning } from "@phosphor-icons/react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error("Remember UI failed", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="fatal-state" role="alert">
        <span><Warning size={25} /></span>
        <h1>Remember could not open this view</h1>
        <p>Your saved data is safe. Reload the app to return to Remember.</p>
        <button className="button primary" type="button" onClick={() => window.location.reload()}><ArrowClockwise size={17} /> Reload app</button>
      </main>
    );
  }
}
