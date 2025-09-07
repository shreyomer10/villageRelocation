// src/config/api.js
const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_BASE_URL || "http://your-domain.com/api/v1",
  ENDPOINTS: {
    // Auth endpoints
    LOGIN: "/auth/login",
    REFRESH_TOKEN: "/auth/refresh",
    
    // Family endpoints
    BENEFICIARIES: (villageId) => `/family/villages/${villageId}/beneficiaries`,
    FAMILY_DETAILS: (familyId) => `/family/families/${familyId}`,
    
    // Village endpoints
    VILLAGES: "/village/villages",
    VILLAGE_DETAILS: (villageId) => `/village/villages/${villageId}`,
    VILLAGE_TIMELINE: "/village/timeline",
    FAMILY_COUNT_ALL: "/village/villages/family-count",
    FAMILY_COUNT_VILLAGE: (villageId) => `/village/villages/${villageId}/family-count`,
    
    // Content endpoints
    GUIDELINES: "/maati/guidelines",
    ABOUT_US: "/maati/aboutUs",
    CONTACT_US: "/maati/contactUs",
    FAQ: "/maati/faq"
  }
};

// Helper function to build API URLs
export const buildApiUrl = (endpoint, params = {}) => {
  let url = `${API_CONFIG.BASE_URL}${endpoint}`;
  
  // Add query parameters if provided
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
      queryParams.append(key, params[key]);
    }
  });
  
  const queryString = queryParams.toString();
  if (queryString) {
    url += `?${queryString}`;
  }
  
  return url;
};

// Helper function to get auth headers
export const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// API response handler
export const handleApiResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP Error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Handle API response format
  if (data.error === false) {
    return data.result;
  } else {
    throw new Error(data.message || 'API Error');
  }
};

// Generic API request function
export const apiRequest = async (endpoint, options = {}) => {
  const { method = 'GET', body = null, params = {}, ...otherOptions } = options;
  
  const url = buildApiUrl(endpoint, params);
  const headers = getAuthHeaders();
  
  const config = {
    method,
    headers,
    ...otherOptions
  };
  
  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, config);
  return handleApiResponse(response);
};

export default API_CONFIG;