// API Configuration - Detecta automaticamente o ambiente
const API_URL = import.meta.env.VITE_API_URL || "http://https://comunidadedorock.onrender.com";

export default API_URL;

// Exemplo de uso em componentes:
// import API_URL from './config/api'
// axios.get(`${API_URL}/api/posts`)
