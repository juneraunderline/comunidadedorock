import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

function Eventos() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    axios.get(`${API_URL}/api/events`)
      .then(res => setEvents(res.data))
      .catch(err => console.error("Erro ao carregar eventos:", err));
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "Data TBD";
    const date = new Date(dateStr + "T00:00:00");
    const options = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('pt-BR', options).toUpperCase();
  };

  const formatWeekday = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', 'feira').toUpperCase();
  };

  const navigate = useNavigate();

  return (
    <div>
      {/* EVENTOS */}
      <section className="section section-dark">
        <div className="section-header">
          <h2>PRÓXIMOS <span className="highlight">EVENTOS</span></h2>
        </div>
        
        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            <p>Nenhum evento agendado no momento. Fique atento!</p>
          </div>
        ) : (
          <div className="events-grid">
            {events.map(event => (
              <div
                key={event.id}
                className="event-card"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/eventos/${event.id}`)}
              >
                <div className="event-image-wrapper">
                  {event.image ? (
                    <img src={getImageUrl(event.image)} alt={event.title} className="event-image" />
                  ) : (
                    <div className="event-image-placeholder">🎸</div>
                  )}
                  <div className="event-badge">{formatWeekday(event.date)}</div>
                  <div className="event-date-badge">
                    <span className="date-day">{new Date(event.date + "T00:00:00").getDate()}</span>
                    <span className="date-month">{new Date(event.date + "T00:00:00").toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}</span>
                  </div>
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
                  
                  {event.description && (
                    <p className="event-description">
                      {event.description.substring(0, 120)}{event.description.length > 120 ? '...' : ''}
                    </p>
                  )}
                  
                  {event.ticket_link ? (
                    <a
                      href={event.ticket_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-buy-tickets"
                      onClick={e => e.stopPropagation()}
                    >
                      🎫 Comprar Ingresso
                    </a>
                  ) : (
                    <button
                      className="btn btn-primary btn-buy-tickets"
                      disabled
                      style={{ opacity: 0.6, cursor: 'not-allowed' }}
                      onClick={e => e.stopPropagation()}
                    >
                      🎫 Link de Venda
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Eventos;
