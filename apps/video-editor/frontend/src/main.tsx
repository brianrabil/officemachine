import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { App } from "./App";
import "./index.css";

const systemAppearance = window.matchMedia("(prefers-color-scheme: dark)");
const syncAppearance = () => {
  document.documentElement.classList.toggle("dark", systemAppearance.matches);
};
syncAppearance();
systemAppearance.addEventListener("change", syncAppearance);

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root element.");

createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
