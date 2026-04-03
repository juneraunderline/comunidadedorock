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
    if (diffMins < 60) return `${diffMins} minuto${diffMins > 1 ? "s" : ""} atrás`;
    if (diffHours < 24) return `${diffHours} hora${diffHours > 1 ? "s" : ""} atrás`;
    if (diffDays < 7) return `${diffDays} dia${diffDays > 1 ? "s" : ""} atrás`;

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const mins = String(date.getMinutes()).padStart(2, "0");

    return `${day}/${month}/${year} às ${hours}:${mins}`;
  };

  const handleImageError = (id) => {
    setBrokenImages((prev) => new Set(prev).add(id));
  };

  useEffect(() => {
    axios.get(`${API_URL}/api/bands`).then((res) => setBands(res.data));
    axios.get(`${API_URL}/api/interviews`).then((res) => setInterviews(res.data));
    axios.get(`${API_URL}/api/events`).then((res) => setEvents(res.data));

    const interval = setInterval(() => {
      axios.get(`${API_URL}/api/bands`).then((res) => setBands(res.data));
      axios.get(`${API_URL}/api/interviews`).then((res) => setInterviews(res.data));
      axios.get(`${API_URL}/api/events`).then((res) => setEvents(res.data));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="home-with-portal">
      <Portal />
      <div className="home-main">

        {/* HERO */}
        <div className="hero" style={{ backgroundImage: `url(${hero})` }}>
          <div className="hero-content">
            <h2>COMUNIDADE<br /><span>DO ROCK</span></h2>
            <p>
              O melhor do rock underground brasileiro em um só lugar. Descubra novas bandas,
              leia entrevistas exclusivas e fique por dentro das últimas notícias.
            </p>

            <div className="hero-buttons">
              <button className="btn btn-primary" onClick={() => navigate("/bandas")}>
                DESCOBRIR BANDAS →
              </button>

              <button className="btn btn-outline" onClick={() => navigate("/entrevistas")}>
                ENTREVISTAS
              </button>
            </div>
          </div>
        </div>

        {/* NOTÍCIAS */}
        <section className="section">
          <div className="section-header">
            <h2>ÚLTIMAS <span className="highlight">NOTÍCIAS</span></h2>
            <button onClick={() => navigate("/noticias")} className="view-all">
              Ver tudo →
            </button>
          </div>

          <div className="grid grid-2">
            {posts.length > 0 ? (
              posts.slice(0, displayCount).map((p) => (
                <div key={p.id} className="card" onClick={() => navigate(`/noticias/${p.id}`)}>
                  <div className="card-image">
                    {p.image ? (
                      <img
                        src={getImageUrl(p.image)}
                        alt={p.title}
                        onError={() => handleImageError(p.id)}
                      />
                    ) : (
                      <div>Sem imagem</div>
                    )}
                  </div>

                  <div className="card-content">
                    <small>{formatDatePT(p.created_at)}</small>
                    <h3>{p.title}</h3>
                    <p>{(p.content || "").slice(0, 100)}...</p>
                  </div>
                </div>
              ))
            ) : (
              <div>Nenhuma notícia publicada ainda.</div>
            )}
          </div>
        </section>

        {/* ENTREVISTAS */}
        <section className="section">
          <div className="section-header">
            <h2>ÚLTIMAS <span className="highlight">ENTREVISTAS</span></h2>
            <button onClick={() => navigate("/entrevistas")} className="view-all">
              Ver tudo →
            </button>
          </div>

          <div className="grid grid-2">
            {interviews.slice(0, 3).map((i) => (
              <div key={i.id} className="card" onClick={() => navigate(`/entrevistas/${i.id}`)}>
                <div className="card-image">
                  <img src={getImageUrl(i.image)} alt={i.title} />
                </div>
                <div className="card-content">
                  <h3>{i.title}</h3>
                  <p><strong>{i.artist}</strong></p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BANDAS */}
        <section className="section section-dark">
          <div className="section-header">
            <h2>BANDAS <span className="highlight">NOVAS</span></h2>
          </div>

          <div className="grid grid-2">
            {bands.slice(0, 3).map((b) => (
              <div key={b.id} className="card" onClick={() => navigate(`/bandas/${b.id}`)}>
                <div className="card-image">
                  <img src={getImageUrl(b.image)} alt={b.name} />
                </div>
                <div className="card-content">
                  <h3>{b.name}</h3>
                  <p>{b.genre}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

export default Home;