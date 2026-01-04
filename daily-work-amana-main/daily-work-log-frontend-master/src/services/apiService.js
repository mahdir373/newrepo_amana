import axios from 'axios';

/* ------------------------------------
   Axios instance
------------------------------------ */
const api = axios.create({
  baseURL:
    process.env.REACT_APP_API_URL ||
    'https://daily-work-amana-main-backend-417811099802.europe-west1.run.app/api',
});

// Attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ------------------------------------
   Auth service
------------------------------------ */
export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getCurrentUser: () => api.get('/auth/me'),
};

/* ------------------------------------
   Daily logs service
------------------------------------ */
export const logService = {
  // Team Leader
  createLog: (logData) => api.post('/logs', logData),
  updateLog: (id, logData) => api.put(`/logs/${id}`, logData),
  getTeamLeaderLogs: () => api.get('/logs/my-logs'),
  getLogById: (id) => api.get(`/logs/${id}`),
  deleteLog: (id) => api.delete(`/logs/${id}`),
  submitLog: (id) => api.put(`/logs/${id}/submit`),

  // Manager
  getAllLogs: (filters) => api.get('/logs', { params: filters }),
  approveLog: (id) => api.put(`/logs/${id}/approve`),
  exportLogToPdf: (id) =>
    api.get(`/logs/${id}/export-pdf`, { responseType: 'blob' }),

  getTeamLeaders: () => api.get('/logs/team-leaders'),
};

/* ------------------------------------
   Project service
------------------------------------ */
export const projectService = {
  getAllProjects: () => api.get('/projects'),
  getActiveProjects: () => api.get('/projects/active'),
  getProjectById: (id) => api.get(`/projects/${id}`),
  createProject: (projectData) => api.post('/projects', projectData),
  updateProject: (id, projectData) =>
    api.put(`/projects/${id}`, projectData),
  deleteProject: (id) => api.delete(`/projects/${id}`),
};

/* ------------------------------------
   Employee service
------------------------------------ */
export const employeeService = {
  getAllEmployees: () => api.get('/employees'),
  getActiveEmployees: () => api.get('/employees/active'),
  getEmployeeById: (id) => api.get(`/employees/${id}`),
  createEmployee: (employeeData) =>
    api.post('/employees', employeeData),
  updateEmployee: (id, employeeData) =>
    api.put(`/employees/${id}`, employeeData),
  deleteEmployee: (id) => api.delete(`/employees/${id}`),
};

/* ------------------------------------
   File upload service (NEW – GCS)
------------------------------------ */
export const fileService = {
  // Upload photos + delivery certificate together
  uploadFiles: (logId, formData) =>
    api.post(`/uploads/${logId}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Delete single file
  deleteFile: (logId, fileType, fileId) =>
    api.delete(`/uploads/${logId}/${fileType}/${fileId}`),
};

/* ------------------------------------
   Notifications
------------------------------------ */
export const notificationService = {
  getUserNotifications: () => api.get('/notifications'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
};

export default api;
