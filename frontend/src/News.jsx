import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

function News() {
  const [posts, setPosts] = useState([]);
  const [displayCount, setDisplayCount] = useState(8);
  const [error, setError] = useState(null);
  const [brokenImages, setBrokenImages] = useState(new Set());
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
      .then(res => {
        let data = res.data;
        if (portalFilter) {
          data = data.filter(p => p.source && p.source.toLowerCase().includes(portalFilter.toLowerCase()));
        }
        setPosts(data);
      })
      .catch(err => {
        console.error("Erro ao buscar posts:", err);
        setError(err.message);
      });
  }, [portalFilter]);

  const visiblePosts = posts.filter(p => p.title && p.content).slice(0, displayCount);
  const hasMore = posts.filter(p => p.title && p.content).length > displayCount;

  const handleImageError = (id) => {
    setBrokenImages(prev => new Set(prev).add(id));
  };

  return (
    <div>
      {/* NOTÍCIAS */}
      <section className="section">
        <div className="section-header">
          <h2>
            ÚLTIMAS <span className="highlight">NOTÍCIAS</span>
            {portalFilter && (
              <span style={{fontSize: "0.8em", marginLeft: "20px", color: "#ff6b00"}}>
                Portal: <strong>{portalFilter}</strong>
                {" "}
                <Link to="/noticias" style={{color: "#ff6b00", textDecoration: "underline", cursor: "pointer"}}>
                  (limpar filtro)
                </Link>
              </span>
            )}
          </h2>
        </div>
        {error && (
          <div style={{gridColumn: "1/-1", textAlign: "center", color: "#d32f2f", padding: "20px", background: "#ffebee", borderRadius: "4px", margin: "20px"}}>
            <strong>Erro ao carregar notícias:</strong> {error}
          </div>
        )}
        <div className="grid grid-2">
          {posts.length > 0 ? (
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
                        onError={() => {
                          console.log("❌ Erro ao carregar imagem:", p.image);
                          handleImageError(p.id);
                        }}
                        onLoad={() => console.log("✅ Imagem carregada OK")}
                      />
                    ) : (
                      <div style={{display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", color: "#999"}}>
                        Sem imagem
                      </div>
                    )}
                    <div className="card-source">{p.source || "Desconhecida"}</div>
                  </div>
                  <div className="card-content">
                    <small className="card-date">{formatDatePT(p.created_at)}</small>
                    {p.source && <small className="card-source-label" style={{display: "block", color: "#999", fontSize: "12px", marginBottom: "8px"}}>Fonte: {p.source}</small>}
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
              {portalFilter ? (
                <>
                  Nenhuma notícia encontrada para o portal <strong>{portalFilter}</strong>.
                  <br />
                  <Link to="/noticias" style={{color: "#ff6b00", textDecoration: "underline"}}>
                    Ver todas as notícias
                  </Link>
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
