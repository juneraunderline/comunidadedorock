import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

const PAGE_SIZE = 3;

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
      const params = { limit: PAGE_SIZE, offset: 0 };
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
      const params = { limit: PAGE_SIZE, offset: bands.length };
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
                  <img src={getImageUrl(band.image) || "https://images.unsplash.com/photo-1516450360452-9312f5ff84d4?w=300&h=300&fit=crop"} alt={band.name} loading="lazy" />
                </div>
                <div className="card-content">
                  <h3>{band.name}</h3>
                  <p>{band.genre}</p>
                  <small>{band.city}, {band.state}</small>
                  {(band.instagram || band.facebook || band.youtube || band.spotify || band.bandcamp || band.site) && (
                    <div style={{ marginTop: "8px", display: "flex", gap: "6px", fontSize: "14px" }}>
                      {band.instagram && <span title="Instagram">📷</span>}
                      {band.facebook && <span title="Facebook">📘</span>}
                      {band.youtube && <span title="YouTube">▶️</span>}
                      {band.spotify && <span title="Spotify">🎵</span>}
                      {band.bandcamp && <span title="Bandcamp">🎶</span>}
                      {band.site && <span title="Site">🌐</span>}
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
