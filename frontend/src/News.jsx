import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import DOMPurify from "dompurify";
import API_URL, { getImageUrl } from "./config/api";

function safeExternalUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function SkeletonCard() { return (
    <div className="card skeleton-card">
      <div className="skeleton skeleton-image"></div>
      <div className="skeleton skeleton-text"></div>
      <div className="skeleton skeleton-text short"></div>
    </div>
  ); }

function News() {
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setBrokenImages] = useState(new Set());
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [searchParams] = useSearchParams();
  const [hasMore, setHasMore] = useState(true);
  const [sources, setSources] = useState([]);
  const navigate = useNavigate();
  
  const portalFilter = searchParams.get('portal');
  const PAGE_SIZE = 8;

  const formatDatePT = (dateString) => {
    if (!dateString) return "Data desconhecida";
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Agora mesmo";
    if (diffMins < 60) return `${diffMins} minuto${diffMins > 1 ? 's' : ''} atrás`;
    if (diffHours < 24) return `${diffHours} hora${diffHours > 1 ? 's' : ''} atrás`;
    if (diffDays < 7) return `${diffDays} dia${diffDays > 1 ? 's' : ''} atrás`;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} às ${hours}:${mins}`;
  };

  // Carregar fontes RSS para o filtro
  useEffect(() => {
    axios.get(`${API_URL}/api/rss-feeds`)
      .then(res => setSources(res.data.map(f => f.name).sort()))
      .catch(err => console.error("Erro ao carregar fontes:", err));
  }, []);

  // Mostra a última lista conhecida e tenta novamente se a API estiver acordando.
  useEffect(() => {
    let active = true;
    let retryTimer;
    const filter = portalFilter || sourceFilter;
    const cacheKey = `cdr_news_v1_${encodeURIComponent(filter || "all")}_${encodeURIComponent(search || "")}`;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (Array.isArray(cached)) {
        setAllPosts(cached);
        setHasMore(cached.length === PAGE_SIZE);
        setLoading(false);
      } else {
        setLoading(true);
      }
    } catch { setLoading(true); }
    setError(null);

    const params = {
      limit: PAGE_SIZE,
      offset: 0,
      search: search || undefined,
      source: filter || undefined
    };
    const load = async (attempt = 0) => {
      try {
        const response = await axios.get(`${API_URL}/api/posts`, { params, timeout: 15000 });
        if (!active) return;
        if (!Array.isArray(response.data)) throw new Error("Resposta inválida da API");
        setAllPosts(response.data);
        setHasMore(response.data.length === PAGE_SIZE);
        setError(null);
        try { localStorage.setItem(cacheKey, JSON.stringify(response.data)); } catch {}
        setLoading(false);
      } catch (err) {
        if (!active) return;
        if (attempt < 2) {
          retryTimer = setTimeout(() => load(attempt + 1), 1800 * (attempt + 1));
          return;
        }
        console.error("Erro ao buscar posts:", err);
        setError("Não foi possível atualizar as notícias agora. Mantivemos os dados salvos; tente novamente em instantes.");
        setLoading(false);
      }
    };
    load();
    return () => { active = false; clearTimeout(retryTimer); };
  }, [search, sourceFilter, portalFilter]);
