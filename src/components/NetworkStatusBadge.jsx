import React, { useState, useEffect } from "react";

export function NetworkStatusBadge() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div style={{ background: "#dc2626", color: "#fff", padding: "8px 16px", textAlign: "center", fontSize: "14px" }}>
      No internet connection. Showing cached catalog.
    </div>
  );
}
