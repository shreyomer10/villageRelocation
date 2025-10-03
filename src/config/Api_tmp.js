// src/config/Api.js
// Named export + default export (safe for both import styles)
export const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_BASE) ||
  process.env.REACT_APP_API_BASE ||
  "https://villagerelocation.onrender.com";

export default API_BASE;
