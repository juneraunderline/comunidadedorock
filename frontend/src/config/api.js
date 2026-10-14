// API Configuration - backend oficial no Vercel.
import axios from "axios";
// Em desenvolvimento, VITE_API_URL pode sobrescrever esta URL.
const API_URL = import.meta.env.VITE_API_URL || "https://comunidadedorock-api.vercel.app";

// Anexa o token de sessão às chamadas da API. O objeto "user" em localStorage
// é apenas estado de interface e nunca é usado pelo servidor como prova de identidade.
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("cdr_session_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Converte caminhos relativos de imagem (/images/...) para URL completa do backend
export function getImageUrl(imagePath) {
  if (!imagePath) return "";
  if (imagePath.startsWith("/images/")) {
    return `${API_URL}${imagePath}`;
  }
  return imagePath;
}

export default API_URL;
