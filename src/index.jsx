import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import App from "./App.jsx";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
