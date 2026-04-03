import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

function BandaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [band, setBand] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/bands`)
      .then(res => {
        const selectedBand = res.data.find(b => b.id === parseInt(id));
        setBand(selectedBand);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
        Carregando...
      </div>
    );
  }

  if (!band) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>Banda não encontrada</h2>
        <button className="btn btn-primary" onClick={() => navigate("/bandas")}>
          Voltar às Bandas
        </button>
      </div>
    );
  }

  return (
    <div className="band-detail-page">
      <section className="band-detail-section">
        <div className="band-detail-container">
          {band.image && (
            <div className="band-detail-image">
              <img src={getImageUrl(band.image)} alt={band.name} />
            </div>
          )}
          
          <div className="band-detail-content">
            <h1>{band.name}</h1>
            
            <div className="band-detail-meta">
              <div className="meta-item">
                <strong>Gênero:</strong> <span>{band.genre}</span>
              </div>
              <div className="meta-item">
                <strong>Localização:</strong> <span>{band.city}, {band.state}</span>
              </div>
              {band.year && (
                <div className="meta-item">
                  <strong>Ano de Formação:</strong> <span>{band.year}</span>
                </div>
              )}
            </div>

            {band.biography && (
              <div className="band-detail-section-box">
                <h3>Sobre a Banda</h3>
                <p>{band.biography}</p>
              </div>
            )}

            {band.members && (
              <div className="band-detail-section-box">
                <h3>Integrantes</h3>
                <p>{band.members}</p>
              </div>
            )}

            {(band.instagram || band.facebook || band.youtube || band.spotify || band.bandcamp || band.site) && (
            <div className="band-detail-social">
              <h3>Redes Sociais</h3>
              <div className="social-links">
                {band.instagram && (
                  <a href={band.instagram} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    📷 Instagram
                  </a>
                )}
                {band.facebook && (
                  <a href={band.facebook} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    📘 Facebook
                  </a>
                )}
                {band.youtube && (
                  <a href={band.youtube} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    ▶️ YouTube
                  </a>
                )}
                {band.spotify && (
                  <a href={band.spotify} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    🎵 Spotify
                  </a>
                )}
                {band.bandcamp && (
                  <a href={band.bandcamp} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    🎶 Bandcamp
                  </a>
                )}
                {band.site && (
                  <a href={band.site} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    🌐 Site Oficial
                  </a>
                )}
              </div>
            </div>
            )}

            {band.contact && (
              <div className="band-detail-section-box">
                <h3>Contato</h3>
                <p>{band.contact}</p>
              </div>
            )}

            <div className="news-detail-share">
              <span>Compartilhe:</span>
              <button className="share-btn whatsapp" onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(band.name + " - Confira no Comunidade do Rock https://comunidadedorock.com.br/og/bandas/" + band.id)}`, '_blank')}>💬 WhatsApp</button>
              <button className="share-btn facebook" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://comunidadedorock.com.br/og/bandas/" + band.id)}`, '_blank')}>f Facebook</button>
              <button className="share-btn twitter" onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(band.name)}&url=${encodeURIComponent("https://comunidadedorock.com.br/og/bandas/" + band.id)}`, '_blank')}>𝕏 Twitter</button>
              <button className="share-btn telegram" onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent("https://comunidadedorock.com.br/og/bandas/" + band.id)}&text=${encodeURIComponent(band.name)}`, '_blank')}>✈ Telegram</button>
            </div>

            <div className="band-detail-actions">
              <button className="btn btn-outline" onClick={() => navigate("/bandas")}>
                Voltar às Bandas
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default BandaDetail;
