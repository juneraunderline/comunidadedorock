import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/events`)
      .then(res => {
        const selected = res.data.find(it => it.slug === id || String(it.id) === String(id));
        setEvent(selected);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro ao carregar evento:", err);
        setLoading(false);
      });
  }, [id]);

  const formatWeekdayFull = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
  };

  if (loading) {
    return <div style={{ padding: 40, color: '#ccc', textAlign: 'center' }}>Carregando evento...</div>;
  }

  if (!event) {
    return (
      <div style={{ padding: 40, color: '#ccc', textAlign: 'center' }}>
        <h2>Evento não encontrado</h2>
        <button className="btn btn-primary" onClick={() => navigate('/eventos')}>
          Voltar para eventos
        </button>
      </div>
    );
  }

  return (
    <div className="section section-dark">
      <div className="section-header">
        <h2>{event.title}</h2>
      </div>
      <div className="event-card" style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
        {event.image && (
          <div
            title="Clique para ampliar o cartaz"
            style={{ width: '100%', height: '380px', overflow: 'hidden', borderRadius: '8px', marginBottom: '20px', cursor: 'zoom-in' }}
            onClick={() => setZoomed(true)}
          >
            <img src={getImageUrl(event.image)} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        {zoomed && event.image && (
          <div
            onClick={() => setZoomed(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out', padding: '20px' }}
          >
            <img src={getImageUrl(event.image)} alt={event.title} style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: '8px' }} />
            <button
              onClick={e => { e.stopPropagation(); setZoomed(false); }}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: '50%', width: '44px', height: '44px', fontSize: '24px', cursor: 'pointer' }}
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        )}
        <div style={{ background: '#16161b', padding: '20px', borderRadius: '8px' }}>
          <p style={{ color: '#e9b61e', fontWeight: 700, marginBottom: '8px' }}>{formatWeekdayFull(event.date)}</p>
          {event.time && <p style={{ color: '#fff', marginBottom: '8px' }}>Hora: <strong>{event.time}</strong></p>}
          {event.location && <p style={{ color: '#fff', marginBottom: '8px' }}>Local: <strong>{event.location}</strong></p>}
          {event.city && event.state && <p style={{ color: '#fff', marginBottom: '8px' }}>Cidade: {event.city} - {event.state}</p>}
          {event.description && <p style={{ color: '#ccc', marginBottom: '16px' }}>{event.description}</p>}
          {event.ticket_link ? (
            <a href={event.ticket_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Comprar ingresso
            </a>
          ) : (
            <span style={{ color: '#999' }}>Link de ingresso não disponível</span>
          )}
        </div>
      </div>
      <div style={{ maxWidth: '900px', margin: '20px auto 0' }}>
        <div className="news-detail-share">
          <span>Compartilhe:</span>
          <button className="share-btn whatsapp" onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(event.title + " | Comunidade do Rock https://comunidadedorock.com.br/og/eventos/" + event.id)}`, '_blank')}>💬 WhatsApp</button>
          <button className="share-btn facebook" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://comunidadedorock.com.br/og/eventos/" + event.id)}`, '_blank')}>f Facebook</button>
          <button className="share-btn twitter" onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(event.title)}&url=${encodeURIComponent("https://comunidadedorock.com.br/og/eventos/" + event.id)}`, '_blank')}>𝕏 Twitter</button>
          <button className="share-btn telegram" onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent("https://comunidadedorock.com.br/og/eventos/" + event.id)}&text=${encodeURIComponent(event.title)}`, '_blank')}>✈ Telegram</button>
          <button className="share-btn" style={{ background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" }} onClick={() => { navigator.clipboard.writeText(event.title + " | Comunidade do Rock https://comunidadedorock.com.br/og/eventos/" + event.id); alert("Link copiado! Cole no Instagram Direct 📷"); }}>📷 Instagram</button>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <button className="btn btn-outline" onClick={() => navigate('/eventos')}>
          Voltar para eventos
        </button>
      </div>
    </div>
  );
}

export default EventDetail;
