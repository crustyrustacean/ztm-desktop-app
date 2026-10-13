import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { applyTheme, loadTheme } from "./lib/theme";

// Apply the saved theme before the first render so the app never flashes the wrong scheme.
loadTheme().then((theme) => {
  applyTheme(theme);
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
