import axios from 'axios';

// La URL base debe apuntar al gateway cuando el frontend corre en el host.
// El gateway (paes-gateway) está expuesto en el puerto 80 del host.
// Si tienes una variable de entorno REACT_APP_API_URL configurada (ej. en .env), la usará.
// De lo contrario, usará 'http://localhost:80'.
const axiosInstance = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:80', // Apunta al gateway en el puerto 80 del host
});

// Interceptor para inyectar automáticamente el token de autenticación en los headers
axiosInstance.interceptors.request.use(cfg => {
    const token = localStorage.getItem('token');
    if (token) {
        // Añade el token al encabezado de autorización si existe
        cfg.headers.Authorization = `Bearer ${token}`;
    }
    return cfg;
}, error => {
    // Manejo de errores de solicitud (antes de ser enviada)
    return Promise.reject(error);
});

export default axiosInstance;
