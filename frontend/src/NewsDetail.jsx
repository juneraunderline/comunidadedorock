import { useParams, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";
import Comentarios from "./Comentarios";
import DOMPurify from "dompurify";

function safeExternalUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function getNewsSummary(content) {
  if (!content) return "";
  const container = document.createElement("div");
  container.innerHTML = DOMPurify.sanitize(content);
  const paragraph = container.querySelector("p");
  const text = (paragraph?.textContent || container.textContent || "")
    .replace(/\s+/g, " ").trim().replace(/\.{3,}\s*$/, "");
  return text ? `${text}...` : "";
}

function NewsDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const formatDatePT = (dateString) => {
    if (!dateString) return "Data desconhecida";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Data desconhecida";
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Agora mesmo";
    if (diffMins < 60) return `${diffMins} minuto${diffMins > 1 ? "s" : ""} atrás`;
    if (diffHours < 24) return `${diffHours} hora${diffHours > 1 ? "s" : ""} atrás`;
    if (diffDays < 7) return `${diffDays} dia${diffDays > 1 ? "s" : ""} atrás`;
    return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }).replace(",", " às");
  };

  const loadPost = useCallback(async () => {
    setLoadError(false);

    // Cada notícia que abriu com sucesso fica guardada neste navegador.
    // Usamos a cópia imediatamente e tentamos atualizar em segundo plano.
    const cacheKey = `comunidadedorock:news:${String(id)}`;
    let cachedPost = null;
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)
          && parsed.title && parsed.content !== undefined) {
          cachedPost = parsed;
          setPost(parsed);
          setLoading(false);
        }
      }
    } catch (cacheError) {
      console.warn("Não foi possível ler o cache local da notícia:", cacheError);
    }

    if (!cachedPost) {
      setLoading(true);
      setPost(null);
    }

    const delays = [0, 1800, 3500];
    let lastError;
    for (const delay of delays) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      try {
        // Busca apenas esta notícia por ID/slug, sem descarregar todo o arquivo de notícias.
        const response = await axios.get(
          `${API_URL}/api/posts/lookup/${encodeURIComponent(id)}`,
          { timeout: 20000 }
        );
        if (!response.data || typeof response.data !== "object" || Array.isArray(response.data)) {
          throw new Error("Resposta inválida da API");
        }
        setPost(response.data);
        setLoading(false);
        setLoadError(false);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(response.data));
        } catch (cacheError) {
          // Cache é um recurso de contingência; falta de espaço não deve impedir a leitura.
          console.warn("Não foi possível salvar o cache local da notícia:", cacheError);
        }
        return;
      } catch (error) {
        if (error?.response?.status === 404) {
          if (!cachedPost) {
            setLoading(false);
            setPost(null);
          }
          return;
        }
        lastError = error;
      }
    }

    if (cachedPost) {
      // A API falhou, mas a cópia previamente aberta continua disponível.
      setPost(cachedPost);
      setLoadError(false);
    } else {
      console.error("Não foi possível abrir a notícia após novas tentativas:", lastError);
      setLoadError(true);
    }
    setLoading(false);
  }, [id, attempt]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      await loadPost();
    };
    if (active) run();
    return () => { active = false; };
  }, [loadPost]);

  useEffect(() => {
    if (!post) return;
    const summary = getNewsSummary(post.content);
    const addMeta = (key, value, attr = "property") => {
      let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, key);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", value || "");
    };
    addMeta("og:title", post.title);
    addMeta("og:description", summary.slice(0, 160));
    addMeta("og:image", getImageUrl(post.image) || "");
    addMeta("og:url", window.location.href);
    addMeta("og:type", "article");
    addMeta("og:site_name", "Comunidade do Rock");
    addMeta("twitter:card", "summary_large_image", "name");
    addMeta("twitter:title", post.title, "name");
    addMeta("twitter:description", summary.slice(0, 160), "name");
    addMeta("twitter:image", getImageUrl(post.image) || "", "name");
    document.title = `${post.title} - Comunidade do Rock`;
  }, [post]);

  const shareOnSocial = (platform) => {
    if (!post) return;
    const url = `https://comunidadedorock.com.br/og/noticias/${post.id}`;
    const title = post.title;
    const text = `${title} - Confira no Comunidade do Rock`;
    const shareUrls = {
      whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(text + " " + url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}&via=ComunidadeRock`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
    };
    if (shareUrls[platform]) window.open(shareUrls[platform], "_blank", "width=600,height=400");
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#aaa" }}>Carregando notícia… tentando conectar ao servidor.</div>;

  if (loadError) {
    return <div style={{ padding: "40px", textAlign: "center", color: "#ddd" }}>
      <h2>Não foi possível carregar esta notícia agora</h2>
      <p style={{ color: "#999" }}>O servidor pode estar acordando ou temporariamente indisponível. Suas notícias não foram alteradas.</p>
      <button className="btn btn-primary" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button>{" "}
      <button className="btn btn-outline" onClick={() => navigate("/noticias")}>Voltar às notícias</button>
    </div>;
  }

  if (!post) {
    return <div style={{ padding: "40px", textAlign: "center" }}>
      <h2>Notícia não encontrada</h2>
      <p style={{ color: "#999" }}>Esta notícia pode ter sido removida ou arquivada. Volte à lista para abrir uma notícia publicada.</p>
      <button className="btn btn-primary" onClick={() => navigate("/noticias")}>Voltar às Notícias</button>
    </div>;
  }

  return (
    <div className="news-detail-page">
      <section className="news-detail-section">
        <div className="news-detail-container">
          {post.image && <div className="news-detail-image"><img src={getImageUrl(post.image)} alt={post.title} /></div>}
          <div className="news-detail-content">
            <h1>{post.title}</h1>
            <div className="news-detail-meta">
              <small>{post.source || "Comunidade do Rock"}</small><span className="separator">•</span>
              <small>{formatDatePT(post.created_at)}</small>
            </div>
            <div className="news-detail-text">
              {post.link ? <>
                <p>{getNewsSummary(post.content)}</p>
                <p style={{ marginTop: "18px", color: "#888", fontSize: "14px" }}>Este conteúdo é um resumo publicado pela Comunidade do Rock. Para ler a matéria completa, acesse o site da fonte.</p>
              </> : <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content || "", { ADD_ATTR: ["target", "rel"] }) }} />}
            </div>
            <div className="news-detail-actions">
              {safeExternalUrl(post.link) && <a href={safeExternalUrl(post.link)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Leia Mais no Site Original →</a>}
              <button className="btn btn-outline" onClick={() => navigate("/noticias")}>Voltar</button>
            </div>
            <div className="news-detail-share">
              <span>Compartilhe:</span>
              <button className="share-btn whatsapp" onClick={() => shareOnSocial("whatsapp")} title="Compartilhar no WhatsApp"><i>💬</i> WhatsApp</button>
              <button className="share-btn twitter" onClick={() => shareOnSocial("twitter")} title="Compartilhar no Twitter"><i>𝕏</i> Twitter</button>
              <button className="share-btn facebook" onClick={() => shareOnSocial("facebook")} title="Compartilhar no Facebook"><i>f</i> Facebook</button>
              <button className="share-btn linkedin" onClick={() => shareOnSocial("linkedin")} title="Compartilhar no LinkedIn"><i>in</i> LinkedIn</button>
              <button className="share-btn telegram" onClick={() => shareOnSocial("telegram")} title="Compartilhar no Telegram"><i>✈</i> Telegram</button>
            </div>
            <Comentarios pageType="post" pageId={post.id} />
          </div>
        </div>
      </section>
    </div>
  );
}

export default NewsDetail;
