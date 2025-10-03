/ / src/config/Api.js
// Frontend API base. Vite picks up VITE_API_BASE at build time.
export const API_BASE =
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) ||
  process.env.REACT_APP_API_BASE ||
  "https://villagerelocation.onrender.com";

// default export (defensive)
export default API_BASE;
