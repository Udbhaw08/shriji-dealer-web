import React from "react";

export function A11yAnnouncer({ message, assertive = false }) {
  if (!message) return null;
  return (
    <div
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {message}
    </div>
  );
}
