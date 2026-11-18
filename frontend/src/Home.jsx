import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";
import logo from "./assets/logo.webp";
import hero from "./assets/hero-stage.webp";
import Portal from "./Portal";

function getHomeCache(key, fallback) {
  try {
    if (typeof window === "undefined") return fallback;
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function hasHomeCache(key) {
  try {
    return typeof window !== "undefined" && !!window.localStorage.getItem(key);
  } catch {
    return false;
  }
}

function saveHomeCache(key, value) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* local storage may be disabled */ }
}

function SkeletonCard() { return (
	    <div className="card skeleton-card">
	      <div className="skeleton skeleton-image"></div>
	      <div className="skeleton skeleton-text"></div>
	      <div className="skeleton skeleton-text short"></div>
	    </div>
	  ); }

function Home({ posts }) {
  const navigate = useNavigate();
  const [bands, setBands] = useState(() => getHomeCache("cdr_home_bands_v1", []));
  const [featuredBand, setFeaturedBand] = useState(() => getHomeCache("cdr_home_featured_band_v1", null));
	  const [interviews, setInterviews] = useState(() => getHomeCache("cdr_home_interviews_v1", []));
	  const [events, setEvents] = useState(() => getHomeCache("cdr_home_events_v1", []));
  const [releases, setReleases] = useState(() => getHomeCache("cdr_home_releases_v1", []));
  const [weeklyClip, setWeeklyClip] = useState(null);
  const [loadingReleases, setLoadingReleases] = useState(() => !hasHomeCache("cdr_home_releases_v1"));
  const normalizeReleaseType = (value) => String(value || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
  const homeReleases = [
    releases.find(r => /video|clipe/.test(normalizeReleaseType(r.type))),
    releases.find(r => normalizeReleaseType(r.type).includes("single"))
  ].filter(Boolean);
	  const [loadingBands, setLoadingBands] = useState(() => !hasHomeCache("cdr_home_bands_v1"));
	  const [loadingInterviews, setLoadingInterviews] = useState(() => !hasHomeCache("cdr_home_interviews_v1"));
	  const [loadingEvents, setLoadingEvents] = useState(() => !hasHomeCache("cdr_home_events_v1"));
	  const loadingPosts = posts.length === 0;

  const [displayCount, setDisplayCount] = useState(6);
  const [, setBrokenImages] = useState(new Set());
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
        (data) => { setBands(data); saveHomeCache("cdr_home_bands_v1", data); setLoadingBands(false); },
        () => setLoadingBands(false)
      );
      // A Banda em Destaque é carregada separadamente para não alterar a ordem cronológica das Bandas Novas.
      fetchWithRetry(
        `${API_URL}/api/bands?sort=featured&limit=1`,
        (data) => { const featured = data?.[0]?.is_weekly_featured ? data[0] : null; setFeaturedBand(featured); saveHomeCache("cdr_home_featured_band_v1", featured); },
        () => setFeaturedBand(null)
      );
      // Buscar entrevistas (com retry)
      fetchWithRetry(
        `${API_URL}/api/interviews?limit=3`,
        (data) => { setInterviews(data); saveHomeCache("cdr_home_interviews_v1", data); setLoadingInterviews(false); },
        () => setLoadingInterviews(false)
      );
      fetchWithRetry(`${API_URL}/api/featured-release`, data => setWeeklyClip(data || null), () => setWeeklyClip(null));
      // Buscar lançamentos (com retry)
      fetchWithRetry(
        `${API_URL}/api/releases?limit=50`,
        (data) => { setReleases(data); saveHomeCache("cdr_home_releases_v1", data); setLoadingReleases(false); },
        () => setLoadingReleases(false)
      );
      // Buscar eventos (com retry)
      fetchWithRetry(
        `${API_URL}/api/events?limit=3&_=${Date.now()}`,
        (data) => { setEvents(data); saveHomeCache("cdr_home_events_v1", data); setLoadingEvents(false); },
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
            <button className="btn btn-primary" onClick={() => navigate("/cadastrar-banda")}>CADASTRE SUA BANDA →</button>
            <button className="btn btn-outline" onClick={() => navigate("/eventos")}>EVENTOS</button>
          </div>
        </div>
      </div>


      {/* BANNER LOCO PUB */}
      <section className="section home-ad-section" style={{ paddingTop: "18px", paddingBottom: "18px" }}>
        <p className="home-ad-label" style={{ textAlign: "center", fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Publicidade</p>
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
              {(posts.length > displayCount || displayCount >= 12) && (
                <div style={{gridColumn: "1/-1", textAlign: "center", padding: "20px"}}>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      if (displayCount >= 12) {
                        navigate("/noticias");
                      } else {
                        setDisplayCount(Math.min(displayCount + 6, 12));
                      }
                    }}
                  >
                    {displayCount >= 12 ? "Ver todas as notícias →" : "Ver Mais ↓"}
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
                  onClick={() => navigate(`/entrevistas/${interview.slug || interview.id}`)}
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

      {/* VOTAÇÃO PÚBLICA */}
      <section className="section" style={{ paddingTop: "12px", paddingBottom: "12px" }}>
        <div style={{ background: "linear-gradient(135deg, #17171f, #242015)", border: "1px solid #6d5717", borderRadius: "14px", padding: "clamp(20px, 4vw, 34px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 260px" }}>
            <span style={{ color: "#e9b61e", fontSize: "12px", fontWeight: 800, letterSpacing: "1.5px" }}>A CENA É QUEM ESCOLHE</span>
            <h2 style={{ color: "#fff", margin: "8px 0", fontSize: "clamp(22px, 4vw, 30px)" }}>🏆 Vote na Banda da Semana</h2>
            <p style={{ color: "#c3c3cc", margin: 0, lineHeight: 1.6 }}>Conheça as bandas participantes, acompanhe os votos e ajude a fortalecer o rock independente. É grátis participar.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/votacao")} style={{ flexShrink: 0 }}>VER VOTAÇÃO →</button>
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
          {loadingReleases ? <><SkeletonCard /><SkeletonCard /></> : homeReleases.length ? homeReleases.map(r => (
            <div className="release-card" key={r.id}>
              <div className="release-image">{r.image ? <img src={getImageUrl(r.image)} alt={r.title} loading="lazy" /> : <div className="release-placeholder">🎧</div>}<span>{r.type || "Single"}</span></div>
              <div className="release-content"><small>{(r.artist || "").replace(/\s*·\s*$/, "")}{r.release_date ? " " + new Date(r.release_date + "T00:00:00").toLocaleDateString("pt-BR") : ""}</small><h3>{r.title}</h3><div className="release-actions">{r.spotify && <a href={r.spotify} target="_blank" rel="noopener noreferrer">🎧 Spotify</a>}{r.youtube && <a href={r.youtube} target="_blank" rel="noopener noreferrer">▶ YouTube</a>}</div></div>
            </div>
          )) : <div style={{gridColumn:"1/-1",textAlign:"center",color:"#888",padding:"30px"}}>Novos lançamentos das bandas independentes aparecerão aqui.</div>}
        </div>
        <div style={{display:"flex",justifyContent:"center",marginTop:"22px"}}><button className="btn btn-primary" onClick={() => navigate("/lancamentos")}>VER MAIS LANÇAMENTOS →</button></div>
      </section>

      {/* Clipe da Semana escolhido manualmente no painel */}
      {weeklyClip && weeklyClip.youtube && (
      <section className="section">
        <div className="section-header"><h2>CLIPE <span className="highlight">EM DESTAQUE</span></h2></div>
        <div className="clip-feature">
          <div className="clip-info"><span className="band-cta-kicker">CLIPE DA SEMANA</span><h3>{weeklyClip.title}</h3><p>{weeklyClip.artist}</p><a className="btn btn-primary" href={weeklyClip.youtube} target="_blank" rel="noopener noreferrer">ASSISTIR NO YOUTUBE →</a></div>
          <div className="clip-player"><iframe src={(() => { try { const url = new URL(weeklyClip.youtube); let id = url.searchParams.get("v"); if (!id && url.hostname.includes("youtu.be")) id = url.pathname.slice(1).split("/")[0]; if (!id && url.pathname.includes("/shorts/")) id = url.pathname.split("/shorts/")[1].split("/")[0]; return id ? "https://www.youtube.com/embed/" + id : weeklyClip.youtube; } catch (e) { return weeklyClip.youtube; } })()} title={weeklyClip.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>
        </div>
      </section>
      )}

      {/* PRÓXIMOS EVENTOS */}
      <section className="section home-events-section">
        <div className="section-header">
          <h2>PRÓXIMOS <span className="highlight">EVENTOS</span></h2>
          <button onClick={() => navigate("/eventos")} className="view-all" style={{border: "none", background: "none", cursor: "pointer", fontSize: "inherit", color: "inherit", textDecoration: "none"}}>Ver tudo →</button>
        </div>
        <style>{`
          .home-events-list { display: flex; flex-direction: column; gap: 12px; }
          .home-event-row { display: grid; grid-template-columns: 76px 112px minmax(0, 1fr) auto; align-items: center; gap: 18px; padding: 14px; background: #151515; border: 1px solid #303030; border-radius: 12px; text-align: left; transition: border-color .2s, background .2s; }
          .home-event-row:hover { border-color: #d6a817; background: #1b1b1b; }
          .home-event-date { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 76px; border-right: 1px solid #383838; padding-right: 14px; color: #f2bd22; line-height: 1; }
          .home-event-date-day { font-size: 32px; font-weight: 900; }
          .home-event-date-month { margin-top: 6px; font-size: 12px; font-weight: 800; letter-spacing: 1px; }
          .home-event-poster { width: 112px; height: 88px; overflow: hidden; border-radius: 8px; background: #242424; display: flex; align-items: center; justify-content: center; }
          .home-event-poster img { width: 100%; height: 100%; object-fit: cover; }
          .home-event-poster-placeholder { font-size: 30px; }
          .home-event-info { min-width: 0; }
          .home-event-title { color: #fff; font-size: 17px; font-weight: 800; line-height: 1.3; margin: 0 0 8px; overflow-wrap: anywhere; }
          .home-event-meta { display: flex; flex-wrap: wrap; gap: 5px 14px; color: #bdbdbd; font-size: 13px; line-height: 1.45; }
          .home-event-meta span { min-width: 0; }
          .home-event-artists { white-space: pre-line; }
          .home-event-button { white-space: nowrap; padding: 10px 16px !important; min-width: 124px; text-align: center; font-size: 12px !important; font-weight: 800 !important; }
          @media (max-width: 640px) {
            .home-events-list { gap: 10px; }
            .home-event-row { grid-template-columns: 54px minmax(0, 1fr); gap: 8px 12px; padding: 11px; }
            .home-event-date { grid-row: 1 / span 2; min-height: 68px; padding-right: 10px; }
            .home-event-date-day { font-size: 27px; }
            .home-event-date-month { font-size: 10px; }
            .home-event-poster { grid-column: 2; grid-row: 1; width: 100%; height: 112px; }
            .home-event-info { grid-column: 2; grid-row: 2; }
            .home-event-title { font-size: 15px; margin-bottom: 6px; }
            .home-event-meta { font-size: 12px; gap: 4px 10px; }
            .home-event-button { grid-column: 2; grid-row: 3; width: 100%; min-width: 0; padding: 10px 12px !important; }
          }
        `}</style>
        {loadingEvents ? (
          <div className="home-events-list">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : events.filter(ev => new Date(ev.date + "T23:59:59") >= new Date()).length > 0 ? (
          <div className="home-events-list">
            {events.filter(ev => new Date(ev.date + "T23:59:59") >= new Date()).slice(0, 3).map(event => {
              const eventDate = event.date ? new Date(event.date + "T00:00:00") : null;
              return (
                <article
                  key={event.id}
                  className="home-event-row"
                  onClick={() => navigate(`/eventos/${event.slug || event.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="home-event-date">
                    <span className="home-event-date-day">{eventDate ? eventDate.getDate() : "—"}</span>
                    <span className="home-event-date-month">{eventDate ? eventDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase() : "DATA"}</span>
                  </div>
                  <div className="home-event-poster">
                    {event.image ? (
                      <img src={getImageUrl(event.image)} alt={event.title} loading="lazy" />
                    ) : (
                      <span className="home-event-poster-placeholder">🎸</span>
                    )}
                  </div>
                  <div className="home-event-info">
                    <h3 className="home-event-title">{event.title}</h3>
                    <div className="home-event-meta">
                      {event.artist && <span className="home-event-artists">🎤 {event.artist}</span>}
                      {event.time && <span>🕒 {event.time}</span>}
                      {(event.location || event.city || event.state) && (
                        <span>📍 {[event.location, event.city, event.state].filter(Boolean).join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary home-event-button"
                    onClick={e => { e.stopPropagation(); navigate(`/eventos/${event.slug || event.id}`); }}
                  >
                    VER EVENTO →
                  </button>
                </article>
              );
            })}
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

