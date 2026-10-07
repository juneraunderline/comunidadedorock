// API Configuration - produção usa o backend oficial hospedado no Fly.io
// Em desenvolvimento, VITE_API_URL pode sobrescrever esta URL.
const API_URL = import.meta.env.VITE_API_URL || "https://comunidadedorock-api.fly.dev";

// Converte caminhos relativos de imagem (/images/...) para URL completa do backend
export function getImageUrl(imagePath) {
  if (!imagePath) return "";
  if (imagePath.startsWith("/images/")) {
    return `${API_URL}${imagePath}`;
  }
  return imagePath;
}

export default API_URL;
