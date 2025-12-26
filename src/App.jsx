// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

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
import PlotPage from "./pages/PlotPage.jsx";
import Building from "./pages/Buildings.jsx";
import PlotDetails from "./pages/PlotDetails.jsx";
import FamilyDetails from "./pages/FamilyDetail.jsx";
import Feedbacks from "./pages/Feedbacks.jsx";
import Material from "./pages/Material.jsx";
import Facilities from "./pages/Facilities.jsx";
import House from "./pages/HousePage.jsx";
import HouseDetails from "./pages/HouseDetails.jsx";
import MaterialDetails from "./pages/MaterialDetails.jsx";
import FacilityDetails from "./pages/FacilitiesDetails.jsx";

export default function App() {
  return (
    <Routes>
      {/* Landing page is the public homepage */}
      <Route path="/" element={<LandingPage />} />
      {/* optional alias */}
      <Route path="/landingpage" element={<LandingPage />} />

      {/* Separate login route */}
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
        path="/plots"
        element={
          <PrivateRoute>
            <PlotPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/house"
        element={
          <PrivateRoute>
            <House />
          </PrivateRoute>
        }
      />
      <Route
        path="/feedbacks"
        element={
          <PrivateRoute>
            <Feedbacks />
          </PrivateRoute>
        }
      />
      <Route
        path="/material"
        element={
          <PrivateRoute>
            <Material />
          </PrivateRoute>
        }
      />
      <Route
        path="/facilities"
        element={
          <PrivateRoute>
            <Facilities />
          </PrivateRoute>
        }
      />

      {/* Protected family detail (admin/staff view) */}
      <Route
        path="/families"
        element={
          <PrivateRoute>
            <FamilyDetails />
          </PrivateRoute>
        }
      />

      <Route
        path="/plots/one/:plotId"
        element={
          <PrivateRoute>
            <PlotDetails />
          </PrivateRoute>
        }
      />

      <Route
        path="/house/one/:homeId"
        element={
          <PrivateRoute>
            <HouseDetails />
          </PrivateRoute>
        }
      />

      {/* Fixed: material detail route — uses materialId param */}
      <Route
        path="/material/one/:materialId"
        element={
          <PrivateRoute>
            <MaterialDetails />
          </PrivateRoute>
        }
      />

      {/* Facility detail route (list is /facilities) */}
      <Route
        path="/facility/one/:facilityId"
        element={
          <PrivateRoute>
            <FacilityDetails />
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

      <Route
        path="/buildings"
        element={
          <PrivateRoute>
            <Building />
          </PrivateRoute>
        }
      />

      <Route
        path="/employees"
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

      {/* Fallback -> go to landing page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
