import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

function Bandas() {
  const navigate = useNavigate();
  const [bands, setBands] = useState([]);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");

  useEffect(() => {
    axios.get(`${API_URL}/api/bands`)
      .then(res => setBands(res.data));

    const interval = setInterval(() => {
      axios.get(`${API_URL}/api/bands`)
        .then(res => setBands(res.data));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const genres = [...new Set(bands.map(b => b.genre).filter(Boolean))].sort();

  const filtered = bands.filter(band => {
    const matchSearch = !search || 
      band.name?.toLowerCase().includes(search.toLowerCase()) ||
      band.genre?.toLowerCase().includes(search.toLowerCase()) ||
      band.city?.toLowerCase().includes(search.toLowerCase());
    const matchGenre = !genreFilter || band.genre === genreFilter;
    return matchSearch && matchGenre;
  });

  return (
    <div>
      {/* BANDAS */}
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

        {(search || genreFilter) && (
          <p style={{ color: "#888", marginBottom: "16px", fontSize: "13px" }}>
            {filtered.length} banda{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
          </p>
        )}

        <div className="grid grid-4">
          {filtered.length > 0 ? (
            filtered.map(band => (
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
                  {(band.instagram || band.facebook || band.youtube || band.spotify || band.bandcamp || band.site) && (
                    <div style={{marginTop: "8px", display: "flex", gap: "6px", fontSize: "14px"}}>
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
            <div style={{gridColumn: "1/-1", textAlign: "center", color: "#666", padding: "40px"}}>
              Nenhuma banda cadastrada ainda.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default Bandas;
