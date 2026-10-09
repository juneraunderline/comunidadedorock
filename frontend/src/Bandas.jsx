import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

const PAGE_SIZE = 3;

// Entrega miniaturas leves na grade, sem alterar a imagem original da página da banda.
function getBandThumbnailUrl(image) {
  const url = getImageUrl(image);
  if (!url || !url.includes("res.cloudinary.com/") || !url.includes("/upload/")) return url;
  return url.replace("/upload/", "/upload/f_auto,q_auto,w_480,c_limit/");
}


// Ícones sociais em SVG para manter a página leve, sem adicionar dependências.
function SocialIcon({ network, color }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, focusable: "false" };
  const paths = {
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="17.5" cy="6.8" r="1.2" /></>,
    facebook: <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.3-1.5 1.6-1.5h1.7V3.7c-.3 0-1.4-.2-2.6-.2-2.6 0-4.3 1.6-4.3 4.4v2H7v3.1h2.9v8z" />,
    youtube: <path d="M23 7.1a3 3 0 0 0-2.1-2.2C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7.1 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.9 3 3 0 0 0 2.1 2.2c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.2 31 31 0 0 0 .5-4.9 31 31 0 0 0-.5-4.9ZM9.7 15.5v-7l6.1 3.5z" />,
    spotify: <path d="M12 1.5A10.5 10.5 0 1 0 12 22.5 10.5 10.5 0 0 0 12 1.5Zm4.8 15.2a.8.8 0 0 1-1.1.3 12 12 0 0 0-8.5-1 .8.8 0 1 1-.4-1.5 13.5 13.5 0 0 1 9.7 1.1.8.8 0 0 1 .3 1.1Zm1.3-2.8a1 1 0 0 1-1.3.3 14.8 14.8 0 0 0-10-1.2 1 1 0 1 1-.6-1.8 16.7 16.7 0 0 1 11.5 1.4 1 1 0 0 1 .4 1.3Zm.1-2.9a1.1 1.1 0 0 1-1.5.4A17.8 17.8 0 0 0 6 10a1.1 1.1 0 1 1-.6-2.1 20 20 0 0 1 12.4 1.6 1.1 1.1 0 0 1 .4 1.5Z" />,
    bandcamp: <path d="M2 18 9.2 6H22l-7.2 12z" />,
    site: <><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><ellipse cx="12" cy="12" rx="4.2" ry="9.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M3.2 9h17.6M3.2 15h17.6" fill="none" stroke="currentColor" strokeWidth="1.6" /></>
  };
  return <svg {...common} style={{ color }} focusable="false">{paths[network]}</svg>;
}

function normalizeSocialUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function SocialLink({ network, label, href, color }) {
  const url = normalizeSocialUrl(href);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} da banda (abre em nova aba)`}
      title={label}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "34px",
        height: "34px",
        borderRadius: "50%",
        color,
        background: "#171720",
        border: "1px solid #33333f",
        textDecoration: "none",
        transition: "transform 160ms ease, border-color 160ms ease, background 160ms ease"
      }}
      onMouseEnter={event => {
        event.currentTarget.style.transform = "translateY(-2px)";
        event.currentTarget.style.borderColor = color;
        event.currentTarget.style.background = "#22222d";
      }}
      onMouseLeave={event => {
        event.currentTarget.style.transform = "translateY(0)";
        event.currentTarget.style.borderColor = "#33333f";
        event.currentTarget.style.background = "#171720";
      }}
    >
      <SocialIcon network={network} color={color} />
    </a>
  );
}

function Bandas() {
  const navigate = useNavigate();
  const [bands, setBands] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${API_URL}/api/band-genres`)
      .then(res => setGenres(Array.isArray(res.data) ? res.data : []))
      .catch(() => setGenres([]));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setBands([]);
    setHasMore(false);

    const timer = setTimeout(() => {
      const params = { limit: PAGE_SIZE, offset: 0, sort: "recent" };
      if (search.trim()) params.search = search.trim();
      if (genreFilter) params.genre = genreFilter;

      axios.get(`${API_URL}/api/bands`, { params })
        .then(res => {
          if (!active) return;
          const data = Array.isArray(res.data) ? res.data : [];
          setBands(data);
          setHasMore(data.length === PAGE_SIZE);
          setLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setError("Não foi possível carregar as bandas. Tente novamente.");
          setLoading(false);
        });
    }, search.trim() ? 300 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, genreFilter]);

  const loadMore = async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const params = { limit: PAGE_SIZE, offset: bands.length, sort: "recent" };
      if (search.trim()) params.search = search.trim();
      if (genreFilter) params.genre = genreFilter;
      const res = await axios.get(`${API_URL}/api/bands`, { params });
      const data = Array.isArray(res.data) ? res.data : [];
      setBands(current => {
        const known = new Set(current.map(band => band.id));
        return [...current, ...data.filter(band => !known.has(band.id))];
      });
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      setError("Não foi possível carregar mais bandas. Tente novamente.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <section className="section section-dark">
        <div className="section-header">
          <h2>BANDAS <span className="highlight">NOVAS</span></h2>
          <Link to="/cadastrar-banda" className="btn btn-primary">Cadastrar Banda</Link>
        </div>

        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="🔍 Buscar por nome, gênero ou cidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: "200px", padding: "10px 14px", background: "#10101a", border: "1px solid #2a2a33", borderRadius: "8px", color: "#fff", fontSize: "14px" }}
          />
          <select
            value={genreFilter}
            onChange={e => setGenreFilter(e.target.value)}
            style={{ padding: "10px 14px", background: "#10101a", border: "1px solid #2a2a33", borderRadius: "8px", color: "#fff", fontSize: "14px", minWidth: "160px" }}
          >
            <option value="">Todos os gêneros</option>
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          {(search || genreFilter) && (
            <button onClick={() => { setSearch(""); setGenreFilter(""); }} style={{ padding: "10px 14px", background: "#333", border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer", fontSize: "13px" }}>✕ Limpar</button>
          )}
        </div>

        {(search || genreFilter) && !loading && (
          <p style={{ color: "#888", marginBottom: "16px", fontSize: "13px" }}>
            {bands.length}{hasMore ? "+" : ""} banda{bands.length !== 1 ? "s" : ""} encontrada{bands.length !== 1 ? "s" : ""}
          </p>
        )}

        <div className="grid grid-4">
          {loading ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#888", padding: "40px" }}>
              Carregando bandas...
            </div>
          ) : bands.length > 0 ? (
            bands.map(band => (
              <div
                key={band.id}
                className="card"
                onClick={() => navigate(`/bandas/${band.slug || band.id}`)}
                style={{ cursor: "pointer" }}
              >
                <div className="card-image">
                  <img src={getBandThumbnailUrl(band.image) || "https://images.unsplash.com/photo-1516450360452-9312f5ff84d4?w=300&h=300&fit=crop"} alt={band.name} loading="lazy" />
                </div>
                <div className="card-content">
                  <h3>{band.name}</h3>
                  <p>{band.genre}</p>
                  <small>{band.city}, {band.state}</small>
                  {(band.instagram || band.facebook || band.youtube || band.spotify || band.bandcamp || band.site) && (
                    <div
                      aria-label={`Redes sociais de ${band.name}`}
                      style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}
                    >
                      <SocialLink network="instagram" label="Instagram" href={band.instagram} color="#E1306C" />
                      <SocialLink network="facebook" label="Facebook" href={band.facebook} color="#1877F2" />
                      <SocialLink network="youtube" label="YouTube" href={band.youtube} color="#FF3030" />
                      <SocialLink network="spotify" label="Spotify" href={band.spotify} color="#1ED760" />
                      <SocialLink network="bandcamp" label="Bandcamp" href={band.bandcamp} color="#629AA9" />
                      <SocialLink network="site" label="Site oficial" href={band.site} color="#E9B61E" />
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#666", padding: "40px" }}>
              {error || "Nenhuma banda encontrada."}
            </div>
          )}
        </div>

        {error && bands.length > 0 && (
          <p style={{ color: "#ff8c8c", textAlign: "center", marginTop: "16px" }}>{error}</p>
        )}

        {!loading && hasMore && (
          <div style={{ textAlign: "center", marginTop: "28px" }}>
            <button
              className="btn btn-primary"
              onClick={loadMore}
              disabled={loadingMore}
              style={{ minWidth: "190px", opacity: loadingMore ? 0.7 : 1 }}
            >
              {loadingMore ? "Carregando..." : "Ver mais bandas"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default Bandas;
