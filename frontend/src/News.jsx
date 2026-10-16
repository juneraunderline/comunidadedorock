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
  const [showArchive, setShowArchive] = useState(false);
  const [archivePosts, setArchivePosts] = useState([]);
  const [archiveHasMore, setArchiveHasMore] = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(false);
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
        setAllPosts(cached); setHasMore(cached.length === PAGE_SIZE); setLoading(false);
      } else setLoading(true);
    } catch { setLoading(true); }
    setError(null);
    const params = { limit: PAGE_SIZE, offset: 0, search: search || undefined, source: filter || undefined };
    const load = async (attempt = 0) => {
      try {
        const response = await axios.get(`${API_URL}/api/posts`, { params, timeout: 15000 });
        if (!active) return;
        if (!Array.isArray(response.data)) throw new Error("Resposta inválida da API");
        setAllPosts(response.data); setHasMore(response.data.length === PAGE_SIZE); setError(null);
        try { localStorage.setItem(cacheKey, JSON.stringify(response.data)); } catch {}
        setLoading(false);
      } catch (err) {
        if (!active) return;
        if (attempt < 2) { retryTimer = setTimeout(() => load(attempt + 1), 1800 * (attempt + 1)); return; }
        console.error("Erro ao buscar posts:", err);
        setError("Não foi possível atualizar as notícias agora. Mantivemos os dados salvos; tente novamente em instantes.");
        setLoading(false);
      }
    };
    load();
    return () => { active = false; clearTimeout(retryTimer); };
  }, [search, sourceFilter, portalFilter]);

  const loadMore = () => {
    const filter = portalFilter || sourceFilter;
    const params = {
      limit: PAGE_SIZE,
      offset: allPosts.length,
      search: search || undefined,
      source: filter || undefined
    };

    axios.get(`${API_URL}/api/posts`, { params })
      .then(res => {
        setAllPosts(prev => [...prev, ...res.data]);
        setHasMore(res.data.length === PAGE_SIZE);
      })
      .catch(err => console.error("Erro ao carregar mais posts:", err));
  };

  const loadArchive = async (reset = false) => {
    if (archiveLoading) return;
    setArchiveLoading(true);
    const offset = reset ? 0 : archivePosts.length;
    try {
      const response = await axios.get(API_URL + "/api/posts/archive", {
        params: { limit: PAGE_SIZE, offset, search: search || undefined, source: (portalFilter || sourceFilter) || undefined },
        timeout: 15000
      });
      setArchivePosts(prev => reset ? response.data : [...prev, ...response.data]);
      setArchiveHasMore(response.data.length === PAGE_SIZE);
    } catch (err) {
      console.error("Erro ao carregar arquivo de notícias:", err);
    } finally {
      setArchiveLoading(false);
    }
  };

  const visiblePosts = allPosts;
  const hasManualPosts = true;

  const handleImageError = (id) => {
    setBrokenImages(prev => new Set(prev).add(id));
  };

  const clearFilters = () => {
    setSearch("");
    setSourceFilter("");
  };



  return (
    <div>
      {/* NOTÍCIAS */}
      <section className="section">
        <div className="section-header">
          <h2>ÚLTIMAS <span className="highlight">NOTÍCIAS</span></h2>
        </div>

        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="🔍 Buscar por título..."
            value={search}
            onChange={e => { setSearch(e.target.value); }}
            style={{ flex: 1, minWidth: "200px", padding: "10px 14px", background: "#10101a", border: "1px solid #2a2a33", borderRadius: "8px", color: "#fff", fontSize: "14px" }}
          />
          <select
            value={sourceFilter}
            onChange={e => { setSourceFilter(e.target.value); }}
            style={{ padding: "10px 14px", background: "#10101a", border: "1px solid #2a2a33", borderRadius: "8px", color: "#fff", fontSize: "14px", minWidth: "200px" }}
          >
            <option value="">Todas as fontes</option>
            {hasManualPosts && <option value="__manual__">📝 Minhas notícias</option>}
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(search || sourceFilter) && (
            <button onClick={clearFilters} style={{ padding: "10px 14px", background: "#333", border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer", fontSize: "13px" }}>✕ Limpar</button>
          )}
        </div>

        {(search || sourceFilter) && !loading && (
          <p style={{ color: "#888", marginBottom: "16px", fontSize: "13px" }}>
            {allPosts.length} notícia{allPosts.length !== 1 ? "s" : ""} encontrada{allPosts.length !== 1 ? "s" : ""}
            {sourceFilter && sourceFilter !== "__manual__" && <> de <strong>{sourceFilter}</strong></>}
            {sourceFilter === "__manual__" && <> <strong>publicadas manualmente</strong></>}
          </p>
        )}

        {error && (
          <div style={{textAlign: "center", color: "#d32f2f", padding: "20px", background: "#ffebee", borderRadius: "4px", margin: "0 0 20px"}}>
            <strong>Erro ao carregar notícias:</strong> {error}
          </div>
        )}
        <div className="grid grid-2">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : visiblePosts.length > 0 ? (
            <>
              {visiblePosts.map((p, idx) => (
                <div 
                  key={p.id} 
                  className="card"
                  onClick={() => navigate(`/noticias/${p.slug || p.id}`)}
                  style={{ 
                    cursor: "pointer",
                    animation: idx >= 8 ? `fadeInUp 0.5s ease-out ${(idx - 8) * 0.1}s both` : "none"
                  }}
                >
                  <div className="card-image">
                    {p.image ? (
                      <img 
                        src={getImageUrl(p.image)} 
                        alt={p.title}
                        onError={() => handleImageError(p.id)}
                      />
                    ) : (
                      <div style={{display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", color: "#999"}}>
                        Sem imagem
                      </div>
                    )}
                    <div className="card-source">{p.source || "Comunidade do Rock"}</div>
                  </div>
                  <div className="card-content">
                    <small className="card-date">{formatDatePT(p.created_at)}</small>
                    {p.source && <small className="card-source-label" style={{display: "block", color: "#999", fontSize: "12px", marginBottom: "8px"}}>Fonte: {p.source}</small>}
                    {!p.source && <small className="card-source-label" style={{display: "block", color: "#e9b61e", fontSize: "12px", marginBottom: "8px"}}>📝 Publicação própria</small>}
                    <h3>{p.title}</h3>
                    {safeExternalUrl(p.link) && (
                      <a
                        href={safeExternalUrl(p.link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginTop: "12px", display: "inline-flex", textDecoration: "none" }}
                      >
                        Leia Mais →
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {hasMore && (
                <div style={{gridColumn: "1/-1", textAlign: "center", padding: "20px"}}>
                  <button 
                    className="btn btn-primary"
                    onClick={loadMore}
                    style={{ marginTop: "20px" }}
                  >
                    Ver Mais ↓
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{gridColumn: "1/-1", textAlign: "center", color: "#666", padding: "40px"}}>
              {(search || sourceFilter) ? (
                <>
                  Nenhuma notícia encontrada com os filtros aplicados.
                  <br />
                  <button onClick={clearFilters} style={{color: "#e9b61e", textDecoration: "underline", cursor: "pointer", background: "none", border: "none", fontSize: "inherit", marginTop: "8px"}}>
                    Limpar filtros
                  </button>
                </>
              ) : (
                "Nenhuma notícia publicada ainda."
              )}
            </div>
          )}
        </div>
      </section>

      <section className="section" style={{ marginTop: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", padding: "18px 20px", border: "1px solid #2a2a33", borderRadius: "10px", background: "#10101a" }}>
          <div>
            <h2 style={{ margin: 0 }}>ARQUIVO <span className="highlight">DE NOTÍCIAS</span></h2>
            <p style={{ color: "#999", margin: "6px 0 0", fontSize: "13px" }}>Notícias antigas preservadas, carregadas aos poucos para manter o site leve.</p>
          </div>
          <button className="btn btn-primary" onClick={() => {
            const next = !showArchive;
            setShowArchive(next);
            if (next && archivePosts.length === 0) loadArchive(true);
          }}>
            {showArchive ? "Ocultar arquivo ↑" : "Consultar arquivo ↓"}
          </button>
        </div>
        {showArchive && (
          <div style={{ marginTop: "18px" }}>
            <div className="grid grid-2">
              {archivePosts.map(p => (
                <div key={p.id} className="card" onClick={() => navigate("/noticias/" + p.id)} style={{ cursor: "pointer" }}>
                  <div className="card-image">
                    {p.image ? <img src={getImageUrl(p.image)} alt={p.title} loading="lazy" /> : <div style={{ padding: "24px", color: "#999" }}>Sem imagem</div>}
                    <div className="card-source">{p.source || "Comunidade do Rock"}</div>
                  </div>
                  <div className="card-content">
                    <small className="card-date">{formatDatePT(p.created_at)}</small>
                    <h3>{p.title}</h3>
                    {safeExternalUrl(p.link) && <a href={safeExternalUrl(p.link)} target="_blank" rel="noopener noreferrer" className="btn btn-primary" onClick={e => e.stopPropagation()} style={{ marginTop: "12px", display: "inline-flex", textDecoration: "none" }}>Leia Mais →</a>}
                  </div>
                </div>
              ))}
            </div>
            {archiveLoading && <p style={{ textAlign: "center", color: "#999" }}>Carregando arquivo...</p>}
            {!archiveLoading && archivePosts.length === 0 && <p style={{ textAlign: "center", color: "#999", padding: "24px" }}>Ainda não há notícias arquivadas. As próximas notícias antigas serão preservadas automaticamente.</p>}
            {archiveHasMore && archivePosts.length > 0 && <div style={{ textAlign: "center", padding: "20px" }}><button className="btn btn-primary" onClick={() => loadArchive(false)} disabled={archiveLoading}>Carregar mais notícias antigas ↓</button></div>}
          </div>
        )}
      </section>
    </div>
  );
}

export default News;
