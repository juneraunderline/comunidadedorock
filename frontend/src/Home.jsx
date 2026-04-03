import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";
import logo from "./assets/logo.png";
import hero from "./assets/hero-stage.jpg";
import Portal from "./Portal";

function Home({ posts }) {
  const navigate = useNavigate();
  const [bands, setBands] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [displayCount, setDisplayCount] = useState(3);
  const [brokenImages, setBrokenImages] = useState(new Set());

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

  const handleImageError = (id) => {
    setBrokenImages(prev => new Set(prev).add(id));
  };

  useEffect(() => {
    // Log dos posts recebidos
    console.log("🏠 Home.jsx - Posts recebidos:", posts.length > 0 ? `${posts.length} posts` : "nenhum");
    if (posts.length > 0) {
      console.log("   Primeiro post:", {
        id: posts[0].id,
        title: posts[0].title?.substring(0, 40),
        image: posts[0].image,
        source: posts[0].source
      });
      console.log("   Tentando carregar imagem de:", posts[0].image);
    }
  }, [posts]);

  useEffect(() => {
    // Buscar bandas na primeira montagem
    axios.get(`${API_URL}/api/bands`)
      .then(res => setBands(res.data));

    // Buscar entrevistas
    axios.get(`${API_URL}/api/interviews`)
      .then(res => setInterviews(res.data));

    // Atualizar a cada 5 segundos
    const interval = setInterval(() => {
      axios.get(`${API_URL}/api/bands`)
        .then(res => setBands(res.data));

      axios.get(`${API_URL}/api/interviews`)
        .then(res => setInterviews(res.data));
    }, 5000);

    // Limpar intervalo quando o componente desmontar
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="home-with-portal">
      <Portal />
      <div className="home-main">
      {/* HERO */}
      <div
        className="hero"
        style={{
          backgroundImage: `url(${hero})`
        }}
      >
        <div className="hero-content">
          <h2>CcOMUNIDADE<br /><span><br></>DO ROCK</span></h2>
          <p>O melhor do rock underground brasileiro em um só lugar. Descubra novas bandas, leia entrevistas exclusivas e fique por dentro das últimas notícias.</p>
          <div className="hero-buttons">
            <button className="btn btn-primary" onClick={() => navigate("/bandas")}>DESCOBRIR BANDAS →</button>
            <button className="btn btn-outline" onClick={() => navigate("/entrevistas")}>ENTREVISTAS</button>
          </div>
        </div>
      </div>

      {/* NOTÍCIAS */}
      <section className="section">
        <div className="section-header">
          <h2>ÚLTIMAS <span className="highlight">NOTÍCIAS</span></h2>
          <button onClick={() => navigate("/noticias")} className="view-all" style={{border: "none", background: "none", cursor: "pointer", fontSize: "inherit", color: "inherit", textDecoration: "none"}}>Ver tudo →</button>
        </div>
        <div className="grid grid-2">
          {posts.length > 0 ? (
            <>
              {posts.slice(0, displayCount).map((p, idx) => (
                <div 
                  key={p.id} 
                  className="card"
                  onClick={() => navigate(`/noticias/${p.id}`)}
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
                    <h3>{p.title}</h3>
                    <p>{(p.content || "").slice(0, 100)}...</p>
                  </div>
                </div>
              ))}
              {posts.length > displayCount && (
                <div style={{gridColumn: "1/-1", textAlign: "center", padding: "20px"}}>
                  <button 
                    className="btn btn-primary"
                    onClick={() => setDisplayCount(displayCount + 8)}
                  >
                    Ver Mais ↓
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{gridColumn: "1/-1", textAlign: "center", color: "#666", padding: "40px"}}>
              Nenhuma notícia publicada ainda.
            </div>
          )}
        </div>
      </section>

      {/* BANDAS */}
      <section className="section section-dark">
        <div className="section-header">
          <h2>BANDAS <span className="highlight">NOVAS</span></h2>
          <button onClick={() => navigate("/bandas")} className="view-all" style={{border: "none", background: "none", cursor: "pointer", fontSize: "inherit", color: "inherit", textDecoration: "none"}}>Ver tudo →</button>
        </div>
        <div className="grid grid-2">
          {bands.length > 0 ? (
            bands.slice(0, 3).map(band => (
              <div 
                key={band.id} 
                className="card"
                onClick={() => navigate(`/bandas/${band.id}`)}
                style={{ cursor: "pointer" }}
              >
                <div className="card-image">
                  <img src={getImageUrl(band.image) || "https://images.unsplash.com/photo-1516450360452-9312f5ff84d4?w=300&h=300&fit=crop"} alt={band.name} />
                </div>
                <div className="card-content">
                  <h3>{band.name}</h3>
                  <p>{band.genre}</p>
                  <small>{band.city}, {band.state}</small>
                </div>
              </div>
            ))
          ) : (
            <div style={{gridColumn: "1/-1", textAlign: "center", color: "#666", padding: "40px"}}>
              Nenhuma banda cadastrada ainda.
            </div>
          )}
        </div>
      </section>

      {/* ENTREVISTAS */}
      <section className="section">
        <div className="section-header">
          <h2>ÚLTIMAS <span className="highlight">ENTREVISTAS</span></h2>
          <button onClick={() => navigate("/entrevistas")} className="view-all" style={{border: "none", background: "none", cursor: "pointer", fontSize: "inherit", color: "inherit", textDecoration: "none"}}>Ver tudo →</button>
        </div>
        <div className="grid grid-2">
          {interviews.length > 0 ? (
            <>
              {interviews.slice(0, 3).map((interview) => (
                <div 
                  key={interview.id} 
                  className="card"
                  onClick={() => navigate(`/entrevistas/${interview.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="card-image">
                    <img src={getImageUrl(interview.image) || "https://images.unsplash.com/photo-1516450360452-9312f5ff84d4?w=300&h=300&fit=crop"} alt={interview.title} />
                  </div>
                  <div className="card-content">
                    <h3>{interview.title}</h3>
                    <p><strong>{interview.artist}</strong></p>
                    <small>Publicado em {formatDatePT(interview.created_at)}</small>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{gridColumn: "1/-1", textAlign: "center", color: "#888"}}>
              Nenhuma entrevista publicada ainda. Volte em breve!
            </div>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}

export default Home;
