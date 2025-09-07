// App.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import { AuthContext } from "./context/AuthContext.jsx"; // keep path if using index.jsx wrapper
import Auth from "./pages/Auth.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Home from "./pages/VillageHome.jsx";
import FamilyList from "./pages/FamilyList";
import PrivateRoute from "./component/PrivateRoute"; // new file below

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Auth />} />
      <Route path="/login" element={<Auth />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/home"
        element={
          <PrivateRoute>
            <Home />
          </PrivateRoute>
        }
      />
      <Route
        path="/family"
        element={
          <PrivateRoute>
            <FamilyList />
          </PrivateRoute>
        }
      />

      {/* Fallback - optional */}
      <Route path="*" element={<Auth />} />
    </Routes>
  );
}
