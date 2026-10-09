import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";
import Comentarios from "./Comentarios";

function normalizeSocialUrl(value, platform) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // URLs completas devem ser preservadas; nomes de usuário viram links absolutos.
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return `https:${raw}`;

  const cleaned = raw.replace(/^\/+/, "").replace(/^@/, "");
  const hostByPlatform = {
    instagram: "https://www.instagram.com/",
    facebook: "https://www.facebook.com/",
    youtube: "https://www.youtube.com/",
    spotify: "https://open.spotify.com/",
    bandcamp: "https://bandcamp.com/"
  };

  // Corrige valores antigos como /@badluv, que o navegador trataria como caminho do próprio site.
  if (platform === "instagram") {
    const instagramPath = cleaned.replace(/^www\.instagram\.com\//i, "").replace(/^instagram\.com\//i, "");
    return `https://www.instagram.com/${instagramPath.replace(/^@/, "").replace(/\/$/, "")}/`;
  }

  return `${hostByPlatform[platform] || "https://"}${cleaned}`;
}


function SocialIcon({ network, color }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, focusable: "false" };
  const paths = {
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="17.5" cy="6.8" r="1.2" /></>,
    facebook: <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.3-1.5 1.6-1.5h1.7V3.7c-.3 0-1.4-.2-2.6-.2-2.6 0-4.3 1.6-4.3 4.4v2H7v3.1h2.9v8z" />,
    youtube: <path d="M23 7.1a3 3 0 0 0-2.1-2.2C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7.1 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.9 3 3 0 0 0 2.1 2.2c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.2 31 31 0 0 0 .5-4.9ZM9.7 15.5v-7l6.1 3.5z" />,
    spotify: <path d="M12 1.5A10.5 10.5 0 1 0 12 22.5 10.5 10.5 0 0 0 12 1.5Zm4.8 15.2a.8.8 0 0 1-1.1.3 12 12 0 0 0-8.5-1 .8.8 0 1 1-.4-1.5 13.5 13.5 0 0 1 9.7 1.1.8.8 0 0 1 .3 1.1Zm1.3-2.8a1 1 0 0 1-1.3.3 14.8 14.8 0 0 0-10-1.2 1 1 0 1 1-.6-1.8 16.7 16.7 0 0 1 11.5 1.4 1 1 0 0 1 .4 1.3Zm.1-2.9a1.1 1.1 0 0 1-1.5.4A17.8 17.8 0 0 0 6 10a1.1 1.1 0 1 1-.6-2.1 20 20 0 0 1 12.4 1.6 1.1 1.1 0 0 1 .4 1.5Z" />,
    bandcamp: <path d="M2 18 9.2 6H22l-7.2 12z" />,
    site: <><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><ellipse cx="12" cy="12" rx="4.2" ry="9.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M3.2 9h17.6M3.2 15h17.6" fill="none" stroke="currentColor" strokeWidth="1.6" /></>
  };
  return <svg {...common} style={{ color }} focusable="false">{paths[network]}</svg>;
}

function SocialLink({ network, label, href, color }) {
  const url = normalizeSocialUrl(href, network);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} da banda (abre em nova aba)`}
      title={label}
      className="band-detail-social-link"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        minWidth: "42px",
        height: "42px",
        padding: "0 12px",
        borderRadius: "22px",
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
      <span>{label}</span>
    </a>
  );
}

function BandaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [band, setBand] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setBand(null);
    axios.get(`${API_URL}/api/bands/${encodeURIComponent(id)}`)
      .then(res => {
        if (!active) return;
        setBand(res.data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setBand(null);
        setLoading(false);
      });
    return () => { active = false; };
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
                <div className="social-links" style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  <SocialLink network="instagram" label="Instagram" href={band.instagram} color="#E1306C" />
                  <SocialLink network="facebook" label="Facebook" href={band.facebook} color="#1877F2" />
                  <SocialLink network="youtube" label="YouTube" href={band.youtube} color="#FF3030" />
                  <SocialLink network="spotify" label="Spotify" href={band.spotify} color="#1ED760" />
                  <SocialLink network="bandcamp" label="Bandcamp" href={band.bandcamp} color="#629AA9" />
                  <SocialLink network="site" label="Site Oficial" href={band.site} color="#E9B61E" />
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
              <button className="share-btn" style={{ background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" }} onClick={() => { navigator.clipboard.writeText(band.name + " | Comunidade do Rock https://comunidadedorock.com.br/og/bandas/" + band.id); alert("Link copiado! Cole no Instagram Direct 📷"); }}>📷 Instagram</button>
            </div>

            <div className="band-detail-actions">
              <button className="btn btn-outline" onClick={() => navigate("/bandas")}>
                Voltar às Bandas
              </button>
            </div>

            <Comentarios pageType="band" pageId={band.id} />
          </div>
        </div>
      </section>
    </div>
  );
}

export default BandaDetail;
