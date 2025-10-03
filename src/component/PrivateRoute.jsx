// src/components/PrivateRoute.jsx
import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function PrivateRoute({ children }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  // if not logged in, redirect to login and preserve the intended location
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // otherwise render children
  return children;
}
