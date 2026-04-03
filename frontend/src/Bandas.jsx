import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

function Bandas() {
  const navigate = useNavigate();
  const [bands, setBands] = useState([]);

  useEffect(() => {
    // Buscar bandas na primeira montagem
    axios.get(`${API_URL}/api/bands`)
      .then(res => setBands(res.data));

    // Atualizar a cada 5 segundos
    const interval = setInterval(() => {
      axios.get(`${API_URL}/api/bands`)
        .then(res => setBands(res.data));
    }, 5000);

    // Limpar intervalo quando o componente desmontar
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {/* BANDAS */}
      <section className="section section-dark">
        <div className="section-header">
          <h2>BANDAS <span className="highlight">NOVAS</span></h2>
          <Link to="/cadastrar-banda" className="btn btn-primary">Cadastrar Banda</Link>
        </div>
        <div className="grid grid-4">
          {bands.length > 0 ? (
            bands.map(band => (
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
