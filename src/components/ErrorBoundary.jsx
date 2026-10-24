import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <p>Please refresh the page to reload the catalog.</p>
          <button onClick={() => window.location.reload()} style={{ padding: "8px 16px" }}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
