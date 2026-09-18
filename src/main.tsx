import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { applyDocumentLocale, DEFAULT_LOCALE } from "./i18n";
import "./styles/fonts.css";
import "./styles/app.css";

applyDocumentLocale(DEFAULT_LOCALE);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
