import React from "react";
import ReactDOM from "react-dom/client";
import "./lib/i18n";
import { initAnalytics, setSuperProperties } from "./lib/analytics";
import i18n from "./lib/i18n";
import App from "./App.tsx";
import "./index.css";

initAnalytics();
setSuperProperties({ app: "manager", locale: i18n.language });
i18n.on("languageChanged", (lng) => setSuperProperties({ locale: lng }));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
