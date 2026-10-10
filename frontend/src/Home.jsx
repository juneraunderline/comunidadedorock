import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";
import logo from "./assets/logo.webp";
import hero from "./assets/hero-stage.webp";
import Portal from "./Portal";

function Home({ posts }) {
  const navigate = useNavigate();
  const [bands, setBands] = useState([]);
  const [featuredBand, setFeaturedBand] = useState(null);
	  const [interviews, setInterviews] = useState([]);
	  const [events, setEvents] = useState([]);
  const [releases, setReleases] = useState([]);
  const [loadingReleases, setLoadingReleases] = useState(true);
	  const [loadingBands, setLoadingBands] = useState(true);
	  const [loadingInterviews, setLoadingInterviews] = useState(true);
	  const [loadingEvents, setLoadingEvents] = useState(true);
	  const loadingPosts = posts.length === 0;

	  const SkeletonCard = () => (
	    <div className="card skeleton-card">
	      <div className="skeleton skeleton-image"></div>
	      <div className="skeleton skeleton-text"></div>
	      <div className="skeleton skeleton-text short"></div>
	    </div>
	  );
  const [displayCount, setDisplayCount] = useState(6);
  const [brokenImages, setBrokenImages] = useState(new Set());
  useEffect(() => {
    const fitReleaseTitles = () => {
      document.querySelectorAll(".release-content h3").forEach((title) => {
        title.style.fontSize = "16px";
        const availableWidth = title.clientWidth;
        if (!availableWidth) return;
        let fontSize = 16;
        while (title.scrollWidth > availableWidth && fontSize > 8) {
          fontSize -= 0.5;
          title.style.fontSize = `${fontSize}px`;
        }
      });
    };

    fitReleaseTitles();
    const observer = new ResizeObserver(fitReleaseTitles);
    document.querySelectorAll(".release-content h3").forEach((title) => observer.observe(title.parentElement));
    window.addEventListener("resize", fitReleaseTitles);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fitReleaseTitles);
    };
  }, [releases]);


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
    // Funcao de retry automatico
    const fetchWithRetry = (url, onSuccess, onError, retries = 3, attempt = 0) => {
      axios.get(url, { timeout: 25000 })
        .then(res => onSuccess(res.data))
        .catch((error) => {
          if (retries > 0) {
            // APIs e bancos com escala para zero podem demorar a acordar após um período sem acessos.
            const delay = Math.min(2000 * (2 ** attempt), 10000);
            setTimeout(() => fetchWithRetry(url, onSuccess, onError, retries - 1, attempt + 1), delay);
          } else if (onError) {
            onError(error);
          }
        });
    };

    // Disparar todas as buscas em paralelo para não travar uma na outra
    const loadData = () => {
      // Buscar bandas (com retry, ordenadas pelas mais recentes)
      fetchWithRetry(
        `${API_URL}/api/bands?sort=recent&limit=3`,
        (data) => { setBands(data); setLoadingBands(false); },
        () => setLoadingBands(false)
      );
      // A Banda em Destaque é carregada separadamente para não alterar a ordem cronológica das Bandas Novas.
      fetchWithRetry(
        `${API_URL}/api/bands?sort=featured&limit=1`,
        (data) => { setFeaturedBand(data?.[0]?.is_weekly_featured ? data[0] : null); },
        () => setFeaturedBand(null)
      );
      // Buscar entrevistas (com retry)
      fetchWithRetry(
        `${API_URL}/api/interviews?limit=3`,
        (data) => { setInterviews(data); setLoadingInterviews(false); },
        () => setLoadingInterviews(false)
      );
      // Buscar lançamentos (com retry)
      fetchWithRetry(
        `${API_URL}/api/releases?limit=4`,
        (data) => { setReleases(data); setLoadingReleases(false); },
        () => setLoadingReleases(false)
      );
      // Buscar eventos (com retry)
      fetchWithRetry(
        `${API_URL}/api/events?limit=3&_=${Date.now()}`,
        (data) => { setEvents(data); setLoadingEvents(false); },
        () => setLoadingEvents(false)
      );
    };

    loadData();

    // Sem polling contínuo: as listagens públicas são servidas com cache.

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
        {/* Link invisível para pré-carregamento com prioridade alta */}
        <link rel="preload" as="image" href={hero} fetchpriority="high" />
        <div className="hero-content">
          <img src={logo} alt="Comunidade do Rock" style={{ maxWidth: "320px", width: "80%", height: "auto", marginBottom: "24px", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.7))" }} />
          <p>O melhor do rock underground brasileiro em um só lugar. Descubra novas bandas, confira eventos e fique por dentro das últimas notícias.</p>
          <div className="hero-buttons">
            <button className="btn btn-primary" onClick={() => navigate("/bandas")}>DESCOBRIR BANDAS →</button>
            <button className="btn btn-outline" onClick={() => navigate("/eventos")}>EVENTOS</button>
          </div>
        </div>
      </div>


      {/* BANNER LOCO PUB */}
      <section className="section" style={{ paddingTop: "10px", paddingBottom: "10px" }}>
        <p style={{ textAlign: "center", fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Publicidade</p>
        <a href="https://www.instagram.com/loco_pub/" target="_blank" rel="noopener noreferrer">
          <img src="https://res.cloudinary.com/dazqhi4ov/image/upload/c_scale,w_800,f_auto,q_auto/e_trim:20/v1776636678/824d6e4e-b0ab-4e0c-808d-0bb53065189d_bjukjn.png" alt="Loco Pub" style={{ width: "100%", maxWidth: "500px", display: "block", margin: "0 auto", borderRadius: "12px", cursor: "pointer" }} />
        </a>
      </section>

      {/* NOTÍCIAS */}
      <section className="section">
        <div className="section-header">
          <h2>ÚLTIMAS <span className="highlight">NOTÍCIAS</span></h2>
          <button onClick={() => navigate("/noticias")} className="view-all" style={{border: "none", background: "none", cursor: "pointer", fontSize: "inherit", color: "inherit", textDecoration: "none"}}>Ver tudo →</button>
        </div>
        <div className="grid grid-2">
	          {loadingPosts ? (
	            <>
	              <SkeletonCard />
	              <SkeletonCard />
	              <SkeletonCard />
	              <SkeletonCard />
	            </>
	          ) : posts.length > 0 ? (
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
	                        loading="lazy"
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


      {/* BANNER LA MUERTE */}
      <section className="section" style={{ paddingTop: "10px", paddingBottom: "10px" }}>
        <p style={{ textAlign: "center", fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Publicidade</p>
        <a href="https://www.instagram.com/lamuertestudiotattoo/" target="_blank" rel="noopener noreferrer">
          <img src="https://res.cloudinary.com/dazqhi4ov/image/upload/c_scale,w_800,f_auto,q_auto/e_trim:20/v1776903446/lamuertetattoo_fikugw.png" alt="La Muerte Tattoo" style={{ width: "100%", maxWidth: "500px", display: "block", margin: "0 auto", borderRadius: "12px", cursor: "pointer" }} />
        </a>
      </section>
      {/* ENTREVISTAS */}
      <section className="section">
        <div className="section-header">
          <h2>ÚLTIMAS <span className="highlight">ENTREVISTAS</span></h2>
          <button onClick={() => navigate("/entrevistas")} className="view-all" style={{border: "none", background: "none", cursor: "pointer", fontSize: "inherit", color: "inherit", textDecoration: "none"}}>Ver tudo →</button>
        </div>
        <div className="grid grid-2">
	          {loadingInterviews ? (
	            <>
	              <SkeletonCard />
	              <SkeletonCard />
	            </>
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
                    <img src={getImageUrl(interview.image) || "https://images.unsplash.com/photo-1516450360452-9312f5ff84d4?w=300&h=300&fit=crop"} alt={interview.title} loading="lazy" />
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
	            <>
	              <SkeletonCard />
	              <SkeletonCard />
	            </>
	          ) : bands.length > 0 ? (
            bands.slice(0, 3).map(band => (
              <div 
                key={band.id} 
                className="card"
                onClick={() => navigate(`/bandas/${band.slug || band.id}`)}
                style={{ cursor: "pointer" }}
              >
                <div className="card-image">
                  <img 
                    src={getImageUrl(band.image) || "https://images.unsplash.com/photo-1516450360452-9312f5ff84d4?w=400&h=400&fit=crop"} 
                    alt={band.name} 
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", backgroundColor: "#111" }}
                  />
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

      {/* CTA PARA BANDAS */}
      <section className="band-cta-section">
        <div className="band-cta-content">
          <span className="band-cta-kicker">🎸 VOCÊ TEM UMA BANDA?</span>
          <h2>COLOQUE SUA BANDA NO <span>MAPA DO ROCK</span></h2>
          <p>Crie seu perfil gratuito no Comunidade do Rock e divulgue sua música, redes sociais, lançamentos e shows para novos fãs.</p>
          <button className="btn btn-primary" onClick={() => navigate("/cadastrar-banda")}>CADASTRAR MINHA BANDA →</button>
        </div>
      </section>

      {/* BANDA DA SEMANA */}
      {!loadingBands && featuredBand && (
      <section className="section band-feature-section">
        <div className="section-header">
          <h2>BANDA <span className="highlight">EM DESTAQUE</span></h2>
          <button onClick={() => navigate("/bandas")} className="view-all" style={{border: "none", background: "none", cursor: "pointer", fontSize: "inherit", color: "inherit", textDecoration: "none"}}>Ver tudo →</button>
        </div>
        <div className="featured-band-card" onClick={() => navigate("/bandas/" + (featuredBand.slug || featuredBand.id))}>
          <div className="featured-band-image"><img src={getImageUrl(featuredBand.image) || "https://images.unsplash.com/photo-1516450360452-9312f5ff84d4?w=800&h=600&fit=crop"} alt={featuredBand.name} /></div>
          <div className="featured-band-content">
            <span className="band-cta-kicker">BANDA DA SEMANA</span>
            <h3>{featuredBand.name}</h3>
            <p className="featured-band-meta">{featuredBand.genre} · {featuredBand.city}{featuredBand.state ? " / " + featuredBand.state : ""}</p>
            <p>Conheça a história, os integrantes, as músicas e as redes da banda.</p>
            <span className="btn btn-primary">CONHECER A BANDA →</span>
          </div>
        </div>
      </section>
      )}

      {/* LANÇAMENTOS */}
      <section className="section">
        <div className="section-header"><h2>LANÇAMENTOS <span className="highlight">DA CENA</span></h2></div>
        <div className="grid grid-2">
          {loadingReleases ? <><SkeletonCard /><SkeletonCard /></> : releases.length ? releases.slice(0,4).map(r => (
            <div className="release-card" key={r.id}>
              <div className="release-image">{r.image ? <img src={getImageUrl(r.image)} alt={r.title} loading="lazy" /> : <div className="release-placeholder">🎧</div>}<span>{r.type || "Single"}</span></div>
              <div className="release-content"><small>{(r.artist || "").replace(/\s*·\s*$/, "")}{r.release_date ? " " + new Date(r.release_date + "T00:00:00").toLocaleDateString("pt-BR") : ""}</small><h3>{r.title}</h3><div className="release-actions">{r.spotify && <a href={r.spotify} target="_blank" rel="noopener noreferrer">🎧 Spotify</a>}{r.youtube && <a href={r.youtube} target="_blank" rel="noopener noreferrer">▶ YouTube</a>}</div></div>
            </div>
          )) : <div style={{gridColumn:"1/-1",textAlign:"center",color:"#888",padding:"30px"}}>Novos lançamentos das bandas independentes aparecerão aqui.</div>}
        </div>
      </section>

      {/* CLIPE DA SEMANA */}
      {!loadingReleases && releases.find(r => r.youtube) && (() => { const clip = releases.find(r => r.youtube); return (
      <section className="section">
        <div className="section-header"><h2>CLIPE <span className="highlight">EM DESTAQUE</span></h2></div>
        <div className="clip-feature">
          <div className="clip-info">
            <span className="band-cta-kicker">CLIPE DA SEMANA</span>
            <h3>{clip.title}</h3>
            <p>{clip.artist}</p>
            <a className="btn btn-primary" href={clip.youtube} target="_blank" rel="noopener noreferrer">ASSISTIR NO YOUTUBE →</a>
          </div>
          <div className="clip-player">
            <iframe
              src={(() => {
                try {
                  const url = new URL(clip.youtube);
                  let videoId = url.searchParams.get("v");
                  if (!videoId && url.hostname.includes("youtu.be")) videoId = url.pathname.slice(1).split("/")[0];
                  if (!videoId && url.pathname.includes("/shorts/")) videoId = url.pathname.split("/shorts/")[1].split("/")[0];
                  return videoId ? `https://www.youtube.com/embed/${videoId}` : clip.youtube;
                } catch {
                  return clip.youtube;
                }
              })()}
              title={clip.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </section>
      ); })()}

      {/* PRÓXIMOS EVENTOS */}
      <section className="section">
        <div className="section-header">
          <h2>PRÓXIMOS <span className="highlight">EVENTOS</span></h2>
          <button onClick={() => navigate("/eventos")} className="view-all" style={{border: "none", background: "none", cursor: "pointer", fontSize: "inherit", color: "inherit", textDecoration: "none"}}>Ver tudo →</button>
        </div>
        {loadingEvents ? (
	          <div className="grid grid-2">
	            <SkeletonCard />
	            <SkeletonCard />
	          </div>
	        ) : events.filter(ev => new Date(ev.date + "T23:59:59") >= new Date()).length > 0 ? (
	          <div className="grid grid-2">
            {events.filter(ev => new Date(ev.date + "T23:59:59") >= new Date()).slice(0, 3).map(event => (
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
                  {(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const eventDay = new Date(event.date + "T00:00:00");
                    const diffDays = Math.round((eventDay - today) / 86400000);
                    const isPast = diffDays < 0;
                    if (isPast) {
                      return (
                        <button className="btn btn-buy-tickets" disabled style={{ opacity: 0.6, cursor: "not-allowed", background: "#666" }} onClick={e => e.stopPropagation()}>
                          Evento realizado em {new Date(event.date + "T00:00:00").toLocaleDateString("pt-BR")}
                        </button>
                      );
                    }
                    return event.ticket_link ? (
                      <a href={event.ticket_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-buy-tickets" onClick={e => e.stopPropagation()}>
                        {diffDays === 0 ? "🔥 É HOJE! - Comprar Ingresso" : diffDays === 1 ? "Comprar Ingresso - Falta 1 dia" : "Comprar Ingresso - Faltam " + diffDays + " dias"}
                      </a>
                    ) : (
                      <button className="btn btn-primary btn-buy-tickets" disabled style={{ opacity: diffDays === 0 ? 1 : 0.6, cursor: "not-allowed" }} onClick={e => e.stopPropagation()}>
                        {diffDays === 0 ? "🔥 É HOJE! - Evento Gratuito" : diffDays === 1 ? "Evento Gratuito - Falta 1 dia" : "Evento Gratuito - Faltam " + diffDays + " dias"}
                      </button>
                    );
                  })()}
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

