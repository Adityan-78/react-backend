// ===== Starting point of the app =====
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Find the empty <div id="root"> in index.html and draw our App inside it.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
