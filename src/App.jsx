// App.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import { AuthContext } from "./context/AuthContext.jsx"; // keep path if using index.jsx wrapper
import Auth from "./pages/Auth.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Home from "./pages/VillageHome.jsx";
import FamilyList from "./pages/FamilyList";
import PrivateRoute from "./component/PrivateRoute"; // new file below
import LandingPage from "./pages/LandingPage.jsx";
// import at top of your router file
import StagePage from "./pages/StagePage";
import EmployeesPage from "./pages/EmployeePages.jsx";
import MeetingsPage from "./pages/MeetingPages.jsx";



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
      

<Route path="/stages" element={<PrivateRoute> <StagePage /> </PrivateRoute>} />
<Route path="/admin/employees" element={<PrivateRoute> <EmployeesPage /> </PrivateRoute>} />

<Route path="/meetings" element={<PrivateRoute> <MeetingsPage /></PrivateRoute>} />
// or if you pass village id param:
<Route path="/meetings/:villageId" element={<PrivateRoute> <MeetingsPage /> </PrivateRoute>} />
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
