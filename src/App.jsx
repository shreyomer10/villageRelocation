// src/App.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";

import Auth from "./pages/Auth.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Home from "./pages/VillageHome.jsx";
import FamilyList from "./pages/FamilyList.jsx";
import PrivateRoute from "./component/PrivateRoute.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import StagePage from "./pages/StagePage.jsx";
import EmployeesPage from "./pages/EmployeePages.jsx";
import MeetingsPage from "./pages/MeetingPages.jsx";
import OptionPage from "./pages/OptionPage.jsx";
import Building from "./pages/Buildings.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
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
        path="/stages"
        element={
          <PrivateRoute>
            <StagePage />
          </PrivateRoute>
        }
      />

      {/* Give Building a dedicated path instead of duplicating `/stages` */}
      <Route
        path="/buildings"
        element={
          <PrivateRoute>
            <Building />
          </PrivateRoute>
        }
      />

      <Route
        path="/admin/employees"
        element={
          <PrivateRoute>
            <EmployeesPage />
          </PrivateRoute>
        }
      />

      <Route
        path="/meetings"
        element={
          <PrivateRoute>
            <MeetingsPage />
          </PrivateRoute>
        }
      />

      <Route
        path="/options"
        element={
          <PrivateRoute>
            <OptionPage />
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

      {/* Fallback: show Auth (or replace with NotFound/Redirect) */}
      <Route path="*" element={<Auth />} />
    </Routes>
  );
}
