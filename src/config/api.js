// src/config/Api.js
// Expose API_BASE to the frontend. Use Vite env var VITE_API_BASE if present,
// otherwise fall back to a sensible default.

export const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_BASE) ||
  process.env.REACT_APP_API_BASE || // just in case someone used CRA-style
  "https://villagerelocation.onrender.com";
