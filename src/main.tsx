import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/manrope";
import App from "./App";
import "./styles/global.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("VANTA could not find its root element.");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
