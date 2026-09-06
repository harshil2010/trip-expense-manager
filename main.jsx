import React from "react";
import { createRoot } from "react-dom/client";
import App from "./trip-expense-manager.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
