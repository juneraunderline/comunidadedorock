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
  const [events, setEvents] = useState([]);
  const [loadingBands, setLoadingBands] = useState(true);
  const [loadingInterviews, setLoadingInterviews] = useState(true);
  const [displayCount, setDisplayCount] = useState(6);
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
      .then(res => {
        setBands(res.data);
        setLoadingBands(false);
      })
      .catch(() => setLoadingBands(false));

    // Buscar entrevistas
    axios.get(`${API_URL}/api/interviews`)
      .then(res => {
        setInterviews(res.data);
        setLoadingInterviews(false);
      })
      .catch(() => setLoadingInterviews(false));

    // Buscar eventos
    axios.get(`${API_URL}/api/events`)
      .then(res => setEvents(res.data));

    // Atualizar a cada 30 segundos
    const interval = setInterval(() => {
      axios.get(`${API_URL}/api/bands`)
        .then(res => setBands(res.data));

      axios.get(`${API_URL}/api/interviews`)
        .then(res => setInterviews(res.data));

      axios.get(`${API_URL}/api/events`)
        .then(res => setEvents(res.data));
    }, 30000);

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
          <img src={logo} alt="Comunidade do Rock" style={{ maxWidth: "320px", width: "80%", height: "auto", marginBottom: "24px", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.7))" }} />
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
                    {p.source && <div className="card-source">{p.source}</div>}
                  </div>
                  <div className="card-content">
                    <small className="card-date" style={{ marginBottom: "6px" }}>{formatDatePT(p.created_at)}</small>
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

      {/* ENTREVISTAS */}
      <section className="section">
        <div className="section-header">
          <h2>ÚLTIMAS <span className="highlight">ENTREVISTAS</span></h2>
          <button onClick={() => navigate("/entrevistas")} className="view-all" style={{border: "none", background: "none", cursor: "pointer", fontSize: "inherit", color: "inherit", textDecoration: "none"}}>Ver tudo →</button>
        </div>
        <div className="grid grid-2">
          {loadingInterviews ? (
            <div style={{gridColumn: "1/-1", textAlign: "center", color: "#888", padding: "40px"}}>
              Carregando entrevistas...
            </div>
          ) : interviews.length > 0 ? (
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

      {/* BANDAS NOVAS */}
      <section className="section">
        <div className="section-header">
          <h2>BANDAS <span className="highlight">NOVAS</span></h2>
          <button onClick={() => navigate("/bandas")} className="view-all" style={{border: "none", background: "none", cursor: "pointer", fontSize: "inherit", color: "inherit", textDecoration: "none"}}>Ver tudo →</button>
        </div>
        <div className="grid grid-2">
          {loadingBands ? (
            <div style={{gridColumn: "1/-1", textAlign: "center", color: "#888", padding: "40px"}}>
              Carregando bandas...
            </div>
          ) : bands.length > 0 ? (
            bands.slice(0, 6).map(band => (
              <div 
                key={band.id} 
                className="card"
                onClick={() => navigate(`/bandas/${band.slug || band.id}`)}
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

      {/* PRÓXIMOS EVENTOS */}
      <section className="section">
        <div className="section-header">
          <h2>PRÓXIMOS <span className="highlight">EVENTOS</span></h2>
          <button onClick={() => navigate("/eventos")} className="view-all" style={{border: "none", background: "none", cursor: "pointer", fontSize: "inherit", color: "inherit", textDecoration: "none"}}>Ver tudo →</button>
        </div>
        {events.length > 0 ? (
          <div className="events-grid">
            {events.slice(0, 3).map(event => (
              <div
                key={event.id}
                className="event-card"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/eventos/${event.slug || event.id}`)}
              >
                <div className="event-image-wrapper">
                  {event.image ? (
                    <img src={getImageUrl(event.image)} alt={event.title} className="event-image" />
                  ) : (
                    <div className="event-image-placeholder">🎸</div>
                  )}
                  {event.date && (
                    <div className="event-date-badge">
                      <span className="date-day">{new Date(event.date + "T00:00:00").getDate()}</span>
                      <span className="date-month">{new Date(event.date + "T00:00:00").toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div className="event-content">
                  <h3 className="event-title">{event.title}</h3>
                  {event.artist && (
                    <p className="event-artist">
                      <span className="event-icon">🎤</span>
                      {event.artist}
                    </p>
                  )}
                  {event.time && (
                    <p className="event-time">
                      <span className="event-icon">🕐</span>
                      {event.time}
                    </p>
                  )}
                  {event.location && (
                    <p className="event-location">
                      <span className="event-icon">📍</span>
                      <strong>{event.location}</strong>
                      {event.city && `, ${event.city}`}
                      {event.state && ` - ${event.state}`}
                    </p>
                  )}
                  {event.ticket_link ? (
                    <a
                      href={event.ticket_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-buy-tickets"
                      onClick={e => e.stopPropagation()}
                    >
                      🎫 Comprar Ingresso
                    </a>
                  ) : (
                    <button
                      className="btn btn-primary btn-buy-tickets"
                      disabled
                      style={{ opacity: 0.6, cursor: 'not-allowed' }}
                      onClick={e => e.stopPropagation()}
                    >
                      🎫 Em breve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{textAlign: "center", color: "#888", padding: "40px"}}>
            Nenhum evento agendado no momento. Fique atento!
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

export default Home;

