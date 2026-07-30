import axios from 'axios';

export const BASE_URL = 'http://localhost:8000';

const api = axios.create({ baseURL: BASE_URL });

export function attachAuthInterceptor(logout) {
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) logout();
      return Promise.reject(error);
    }
  );
}

export default api;