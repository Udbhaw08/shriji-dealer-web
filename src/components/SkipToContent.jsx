import React from "react";

export function SkipToContent({ targetId = "main-content" }) {
  return (
    <a
      href={`#${targetId}`}
      style={{
        position: "absolute",
        left: -9999,
        top: "auto",
        width: 1,
        height: 1,
        overflow: "hidden",
        zIndex: 9999,
      }}
      onFocus={(e) => {
        e.target.style.left = "16px";
        e.target.style.top = "16px";
        e.target.style.width = "auto";
        e.target.style.height = "auto";
      }}
      onBlur={(e) => {
        e.target.style.left = "-9999px";
        e.target.style.width = "1px";
        e.target.style.height = "1px";
      }}
    >
      Skip to main content
    </a>
  );
}
