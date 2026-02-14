// API Configuration - Auto-detect environment
const getApiUrl = () => {
    // Check if we're in development (localhost)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:8000';
    }
    // In production, use the same origin as the frontend
    return window.location.origin;
};

// Export configuration
const API_BASE_URL = getApiUrl();
const API_URL = `${API_BASE_URL}/api/v1`;
const SOCKET_URL = API_BASE_URL;

console.log('Environment detected:', window.location.hostname);
console.log('API URL:', API_URL);
console.log('Socket URL:', SOCKET_URL);
