import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "./config/api";

function Eventos() {
  const [events, setEvents] = useState([]);
  const [submission, setSubmission] = useState({ title: "", artist: "", date: "", time: "", location: "", city: "", state: "", image: "", ticket_link: "", description: "", contact_email: "" });
  const [sending, setSending] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

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

        <div style={{ maxWidth: "900px", margin: "0 auto 36px", padding: "24px", background: "#15151f", border: "1px solid #343442", borderRadius: "10px" }}>
          <h3 style={{ color: "#e9b61e", marginTop: 0 }}>Divulgue o evento da sua banda</h3>
          <p style={{ color: "#aaa", lineHeight: 1.6 }}>Cadastre seu show gratuitamente. Nossa equipe vai revisar as informações antes de publicar na agenda.</p>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setSending(true);
            setSubmitMessage("");
            try {
              const response = await axios.post(API_URL + "/api/event-submissions", submission);
              setSubmitMessage(response.data.message || "Evento enviado para análise da administração!");
              setSubmission({ title: "", artist: "", date: "", time: "", location: "", city: "", state: "", image: "", ticket_link: "", description: "", contact_email: "" });
            } catch (error) {
              setSubmitMessage(error.response?.data?.error || "Não foi possível enviar agora. Tente novamente.");
            } finally {
              setSending(false);
            }
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              {[
                ["title", "Nome do evento *", "Ex.: Festival Rock Independente", "text", true],
                ["artist", "Banda / artista *", "Nome da banda", "text", true],
                ["date", "Data do evento *", "", "date", true],
                ["time", "Horário", "", "time", false],
                ["location", "Local / casa de shows", "Nome do local", "text", false],
                ["city", "Cidade", "Ex.: São Paulo", "text", false],
                ["state", "Estado", "Ex.: SP", "text", false],
                ["contact_email", "E-mail para contato *", "email@exemplo.com", "email", true],
                ["image", "Link do cartaz (opcional)", "https://...", "url", false],
                ["ticket_link", "Link dos ingressos (opcional)", "https://...", "url", false]
              ].map(([field, label, placeholder, type, required]) => (
                <label key={field} style={{ display: "flex", flexDirection: "column", gap: "6px", color: "#ddd", fontSize: "13px" }}>
                  {label}
                  <input type={type} required={required} value={submission[field]} placeholder={placeholder} onChange={(e) => setSubmission({ ...submission, [field]: e.target.value })} style={{ boxSizing: "border-box", width: "100%", padding: "11px", border: "1px solid #454552", borderRadius: "5px", background: "#20202b", color: "#fff" }} />
                </label>
              ))}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "14px", color: "#ddd", fontSize: "13px" }}>
              Descrição do evento
              <textarea rows="4" maxLength={3000} value={submission.description} placeholder="Conte um pouco sobre o show, atrações e informações importantes..." onChange={(e) => setSubmission({ ...submission, description: e.target.value })} style={{ boxSizing: "border-box", width: "100%", padding: "11px", border: "1px solid #454552", borderRadius: "5px", background: "#20202b", color: "#fff", resize: "vertical" }} />
            </label>
            <button type="submit" disabled={sending} className="btn btn-primary" style={{ marginTop: "16px", opacity: sending ? 0.7 : 1 }}>
              {sending ? "ENVIANDO..." : "ENVIAR PARA APROVAÇÃO"}
            </button>
            {submitMessage && <p role="status" style={{ marginBottom: 0, color: submitMessage.toLowerCase().includes("não foi") || submitMessage.toLowerCase().includes("válido") || submitMessage.toLowerCase().includes("preencha") ? "#ff8b8b" : "#9fda9f" }}>{submitMessage}</p>}
          </form>
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
                onClick={() => navigate(`/eventos/${event.slug || event.id}`)}
              >
                <div className="event-image-wrapper">
                  {event.image ? (
                    <img src={event.image} alt={event.title} className="event-image" />
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
