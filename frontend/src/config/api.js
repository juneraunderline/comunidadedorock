// API Configuration - backend oficial no Vercel.
// Em desenvolvimento, VITE_API_URL pode sobrescrever esta URL.
const API_URL = import.meta.env.VITE_API_URL || "https://comunidadedorock-api.vercel.app";

// Converte caminhos relativos de imagem (/images/...) para URL completa do backend
export function getImageUrl(imagePath) {
  if (!imagePath) return "";
  if (imagePath.startsWith("/images/")) {
    return `${API_URL}${imagePath}`;
  }
  return imagePath;
}

export default API_URL;
