"use client";

/**
 * MapErrorBoundary — catches React-visible (render/commit-phase) Mapbox init
 * failures.
 *
 * WHY a class-component error boundary:
 * React error boundaries must be class components; functional components
 * cannot use componentDidCatch / getDerivedStateFromError. next/dynamic does
 * NOT catch render-phase errors thrown inside the dynamic chunk — without this
 * boundary, a "Failed to initialize WebGL" throw from Mapbox during the render
 * or commit phase leaves the user with a blank screen and no indication of why.
 *
 * SCOPE: this boundary catches only render/commit-phase throws. It does NOT
 * catch async Mapbox errors from callbacks, timers, workers, or event handlers
 * — those fire outside React's call stack. Async Mapbox errors are handled
 * separately by the onError logger in Map.tsx; the up-front WebGL probe in
 * MapWrapper handles the common "no WebGL at all" case (probe → skip mount
 * entirely). This boundary is a safety net for the rare case where the probe
 * passes but Mapbox still throws during the React render/commit cycle (e.g.
 * some older Android WebViews).
 *
 * On error: renders null (invisible) and fires onError() so the orchestrator
 * (MapWrapper) can switch to the list fallback.
 */

import { Component } from "react";
import type { ReactNode } from "react";

interface Props {
  /** Called when the Map throws during render/init. Use to activate fallback. */
  onError: () => void;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    // Log for diagnostics; do not surface to the user (the onError callback
    // handles the visible fallback transition).
    console.error("[MapErrorBoundary] Map failed to initialize:", error);
    this.props.onError();
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Render nothing — MapWrapper takes over and shows the list + banner.
      return null;
    }
    return this.props.children;
  }
}
