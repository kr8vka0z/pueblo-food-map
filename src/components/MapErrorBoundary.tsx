"use client";

/**
 * MapErrorBoundary — catches synchronous Mapbox/WebGL init failures.
 *
 * WHY a class-component error boundary:
 * React error boundaries must be class components; functional components
 * cannot use componentDidCatch / getDerivedStateFromError. next/dynamic does
 * NOT catch render-phase errors thrown inside the dynamic chunk — without this
 * boundary, a "Failed to initialize WebGL" throw from Mapbox leaves the user
 * with a blank screen and no indication of why.
 *
 * On error: renders null (invisible) and fires onError() so the orchestrator
 * (MapWrapper) can switch to the list fallback. The WebGL probe in MapWrapper
 * handles the common case (probe → skip mount entirely); this boundary is a
 * safety net for devices where the probe passes but Mapbox still throws during
 * init (rare but real on some older Android WebViews).
 */

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

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

  componentDidCatch(error: Error, _info: ErrorInfo): void {
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
