import axios from 'axios';
import { API_URL } from '../utils/constants.js';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Request failed';
    const normalizedError = new Error(message);
    normalizedError.status = error.response?.status;
    normalizedError.errors = error.response?.data?.errors || [];
    throw normalizedError;
  }
);

export default api;
