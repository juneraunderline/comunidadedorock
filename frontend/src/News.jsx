import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

function News() {
  const [allPosts, setAllPosts] = useState([]);
  const [displayCount, setDisplayCount] = useState(8);
  const [error, setError] = useState(null);
  const [brokenImages, setBrokenImages] = useState(new Set());
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const portalFilter = searchParams.get('portal');

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

  useEffect(() => {
    axios.get(`${API_URL}/api/posts`)
      .then(res => setAllPosts(res.data))
      .catch(err => {
        console.error("Erro ao buscar posts:", err);
        setError(err.message);
      });
  }, []);

  // Aplicar filtro do portal (query param) ao montar
  useEffect(() => {
    if (portalFilter) setSourceFilter(portalFilter);
  }, [portalFilter]);

  // Extrair fontes únicas para o select
  const sources = [...new Set(allPosts.map(p => p.source).filter(Boolean))].sort();
  const hasManualPosts = allPosts.some(p => !p.source);

  // Filtrar posts
  const filtered = allPosts.filter(p => {
    if (!p.title || !p.content) return false;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    let matchSource = true;
    if (sourceFilter === "__manual__") {
      matchSource = !p.source;
    } else if (sourceFilter) {
      matchSource = p.source && p.source.toLowerCase().includes(sourceFilter.toLowerCase());
    }
    return matchSearch && matchSource;
  });

  const visiblePosts = filtered.slice(0, displayCount);
  const hasMore = filtered.length > displayCount;

  const handleImageError = (id) => {
    setBrokenImages(prev => new Set(prev).add(id));
  };

  const clearFilters = () => {
    setSearch("");
    setSourceFilter("");
    setDisplayCount(8);
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
            onChange={e => { setSearch(e.target.value); setDisplayCount(8); }}
            style={{ flex: 1, minWidth: "200px", padding: "10px 14px", background: "#10101a", border: "1px solid #2a2a33", borderRadius: "8px", color: "#fff", fontSize: "14px" }}
          />
          <select
            value={sourceFilter}
            onChange={e => { setSourceFilter(e.target.value); setDisplayCount(8); }}
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

        {(search || sourceFilter) && (
          <p style={{ color: "#888", marginBottom: "16px", fontSize: "13px" }}>
            {filtered.length} notícia{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
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
          {filtered.length > 0 ? (
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
                    <p>{(p.content || "").slice(0, 100)}...</p>
                  </div>
                </div>
              ))}
              {hasMore && (
                <div style={{gridColumn: "1/-1", textAlign: "center", padding: "20px"}}>
                  <button 
                    className="btn btn-primary"
                    onClick={() => setDisplayCount(displayCount + 8)}
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
    </div>
  );
}

export default News;
