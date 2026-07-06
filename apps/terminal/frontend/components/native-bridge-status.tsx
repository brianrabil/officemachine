"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    zero?: unknown;
  }
}

export function NativeBridgeStatus() {
  const [bridge, setBridge] = useState("checking...");

  useEffect(() => {
    setBridge(window.zero ? "available" : "not enabled");
  }, []);

  return (
    <div className="card">
      <span>Native bridge</span>
      <strong>{bridge}</strong>
    </div>
  );
}
