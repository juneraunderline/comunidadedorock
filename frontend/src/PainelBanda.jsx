import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "./config/api";

const inputStyle = { width: "100%", padding: "11px 12px", background: "#10101a", border: "1px solid #34343d", borderRadius: "7px", color: "#fff", fontSize: "14px", boxSizing: "border-box" };
const fields = [
  ["name", "Nome da banda"], ["genre", "Gênero musical"], ["city", "Cidade"], ["state", "Estado"],
  ["year", "Ano de formação"], ["contact", "Contato / e-mail"], ["instagram", "Instagram"],
  ["facebook", "Facebook"], ["youtube", "YouTube"], ["spotify", "Spotify"], ["bandcamp", "Bandcamp"], ["site", "Site oficial"]
];

export default function PainelBanda({ user }) {
  const navigate = useNavigate();
  const token = localStorage.getItem("cdr_session_token");
  const headers = useMemo(() => token ? { Authorization: `Bearer ${token}` } : {}, [token]);
  const [band, setBand] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newRelease, setNewRelease] = useState({ title: "", type: "Single", release_date: "", image: "", spotify: "", youtube: "", description: "" });
  const [newEvent, setNewEvent] = useState({ title: "", artist: "", date: "", time: "", location: "", city: "", state: "", image: "", ticket_link: "", ticket_location: "", description: "", contact_email: user?.email || "" });
  const [sendingEvent, setSendingEvent] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setError("");
    try {
      const mine = await axios.get(`${API_URL}/api/band-claims/mine`, { headers });
      if (mine.data.bands?.length) setBand((await axios.get(`${API_URL}/api/my-band`, { headers })).data);
      else setBand(null);
    } catch (err) { setError(err.response?.data?.error || "Não foi possível carregar o painel."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!user) { navigate("/login", { state: { from: "/painel-banda" } }); return; }
    if (!(user.is_band || user.role === "banda")) { setError("Esta área é exclusiva para contas cadastradas como banda. Se você representa uma banda, fale com a administração para orientar a mudança do tipo de conta."); setLoading(false); return; }
    load();
  }, [user?.id]);

  const saveBand = async (event) => {
    event.preventDefault(); setError(""); setMessage(""); setSaving(true);
    try {
      const response = await axios.put(`${API_URL}/api/my-band`, band, { headers });
      setBand(response.data.band); setMessage("Perfil atualizado com sucesso.");
    } catch (err) { setError(err.response?.data?.error || "Não foi possível salvar o perfil."); }
    finally { setSaving(false); }
  };

  if (!user) return null;
  return <section className="section" style={{ marginTop: 80, minHeight: "75vh" }}>
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ color: "#fff", marginBottom: 8 }}>PAINEL <span className="highlight">DA BANDA</span></h1>
      <p style={{ color: "#aaa", marginBottom: 24 }}>A administração vincula cada conta ao perfil correto da banda. O acesso de edição só é liberado após a vinculação manual.</p>
      {message && <div role="status" style={{ background: "#153323", border: "1px solid #2f754b", color: "#a6efbf", padding: 12, borderRadius: 8, marginBottom: 16 }}>{message}</div>}
      {error && <div role="alert" style={{ background: "#3b191d", border: "1px solid #7a3038", color: "#ffb6bd", padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>}
      {loading ? <p style={{ color: "#aaa" }}>Carregando painel...</p> : !(user.is_band || user.role === "banda") ? <Link to="/perfil" className="btn btn-outline">Voltar ao perfil</Link> : band ? <>
        <div style={{ background: "#15151d", border: "1px solid #34343d", borderRadius: 12, padding: 22, marginBottom: 20 }}>
          <h2 style={{ color: "#e9b61e", marginTop: 0 }}>Perfil oficial vinculado: {band.name}</h2>
          <p style={{ color: "#999", marginBottom: 18 }}>As alterações são aplicadas somente ao perfil aprovado vinculado à sua conta.</p>
          <form onSubmit={saveBand} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
            {fields.map(([key, label]) => <label key={key} style={{ color: "#ccc", fontSize: 13 }}>{label}<input style={inputStyle} value={band[key] || ""} onChange={e => setBand(current => ({ ...current, [key]: e.target.value }))} maxLength={2000} /></label>)}
            <label style={{ color: "#ccc", fontSize: 13, gridColumn: "1 / -1" }}>Integrantes (um por linha: Nome — instrumento/função — @instagram)<textarea style={{ ...inputStyle, minHeight: 110 }} value={band.members || ""} onChange={e => setBand(current => ({ ...current, members: e.target.value }))} maxLength={5000} /></label>
            <label style={{ color: "#ccc", fontSize: 13, gridColumn: "1 / -1" }}>Biografia<textarea style={{ ...inputStyle, minHeight: 150 }} value={band.biography || ""} onChange={e => setBand(current => ({ ...current, biography: e.target.value }))} maxLength={12000} /></label>
            <label style={{ color: "#ccc", fontSize: 13, gridColumn: "1 / -1" }}>URL segura da imagem (HTTPS)<input style={inputStyle} value={band.image || ""} onChange={e => setBand(current => ({ ...current, image: e.target.value }))} maxLength={2000} /></label>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button>
              <Link to={`/bandas/${band.id}`} className="btn btn-outline">Ver perfil público</Link>
              <Link to="/cadastrar-evento" className="btn btn-outline">Enviar show / evento</Link>
            </div>
          </form>
        </div>
        <div style={{ background: "#15151d", border: "1px solid #34343d", borderRadius: 12, padding: 22, marginBottom: 20 }}>
          <h2 style={{ color: "#e9b61e", marginTop: 0 }}>Cadastrar show / evento</h2>
          <p style={{ color: "#999" }}>Envie o evento por aqui. Ele ficará pendente até a aprovação da administração.</p>
          <form onSubmit={async (event) => {
            event.preventDefault(); setError(""); setMessage(""); setSendingEvent(true);
            try {
              const response = await axios.post(API_URL + "/api/event-submissions", { ...newEvent, artist: newEvent.artist.trim() || band.name }, { headers });
              setMessage(response.data.message || "Evento enviado para análise da administração.");
              setNewEvent({ title: "", artist: band.name || "", date: "", time: "", location: "", city: band.city || "", state: band.state || "", image: "", ticket_link: "", ticket_location: "", description: "", contact_email: user?.email || "" });
            } catch (err) { setError(err.response?.data?.error || "Não foi possível enviar o evento."); }
            finally { setSendingEvent(false); }
          }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <label style={{ color: "#ccc", fontSize: 13 }}>Nome do evento (opcional)<input maxLength={250} style={inputStyle} value={newEvent.title} onChange={e => setNewEvent(v => ({ ...v, title: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>Bandas / artistas *<textarea required maxLength={1500} style={{ ...inputStyle, minHeight: 75 }} value={newEvent.artist || band.name || ""} onChange={e => setNewEvent(v => ({ ...v, artist: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>Data *<input required type="date" style={inputStyle} value={newEvent.date} onChange={e => setNewEvent(v => ({ ...v, date: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>Horário<input type="time" style={inputStyle} value={newEvent.time} onChange={e => setNewEvent(v => ({ ...v, time: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>Local<input style={inputStyle} value={newEvent.location} onChange={e => setNewEvent(v => ({ ...v, location: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>Cidade<input style={inputStyle} value={newEvent.city} onChange={e => setNewEvent(v => ({ ...v, city: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>Estado<input style={inputStyle} value={newEvent.state} onChange={e => setNewEvent(v => ({ ...v, state: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>Cartaz (URL)<input type="url" style={inputStyle} value={newEvent.image} onChange={e => setNewEvent(v => ({ ...v, image: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>Link dos ingressos<input type="url" style={inputStyle} value={newEvent.ticket_link} onChange={e => setNewEvent(v => ({ ...v, ticket_link: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>Ponto de venda<input style={inputStyle} value={newEvent.ticket_location} onChange={e => setNewEvent(v => ({ ...v, ticket_location: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>E-mail de contato *<input required type="email" style={inputStyle} value={newEvent.contact_email} onChange={e => setNewEvent(v => ({ ...v, contact_email: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13, gridColumn: "1 / -1" }}>Descrição<textarea maxLength={3000} style={{ ...inputStyle, minHeight: 90 }} value={newEvent.description} onChange={e => setNewEvent(v => ({ ...v, description: e.target.value }))} /></label>
            <div style={{ gridColumn: "1 / -1" }}><button className="btn btn-primary" type="submit" disabled={sendingEvent}>{sendingEvent ? "Enviando..." : "Enviar evento para moderação"}</button></div>
          </form>
        </div>
        <div style={{ background: "#15151d", border: "1px solid #34343d", borderRadius: 12, padding: 22, marginBottom: 20 }}>
          <h2 style={{ color: "#e9b61e", marginTop: 0 }}>Enviar novo lançamento</h2>
          <p style={{ color: "#999", marginBottom: 16 }}>Singles, EPs, álbuns, demos e clipes passam por aprovação antes de aparecer no portal.</p>
          <form onSubmit={async (event) => {
            event.preventDefault(); setError(""); setMessage("");
            try {
              const response = await axios.post(API_URL + "/api/band-release-submissions", newRelease, { headers });
              setMessage(response.data.message || "Lançamento enviado para moderação.");
              setNewRelease({ title: "", type: "Single", release_date: "", image: "", spotify: "", youtube: "", description: "" });
            } catch (err) { setError(err.response?.data?.error || "Não foi possível enviar o lançamento."); }
          }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <label style={{ color: "#ccc", fontSize: 13 }}>Título<input required maxLength={250} style={inputStyle} value={newRelease.title} onChange={e => setNewRelease(current => ({ ...current, title: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>Tipo<select style={inputStyle} value={newRelease.type} onChange={e => setNewRelease(current => ({ ...current, type: e.target.value }))}>{["Single", "EP", "Álbum", "Clipe", "Demo"].map(type => <option key={type}>{type}</option>)}</select></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>Data<input type="date" style={inputStyle} value={newRelease.release_date} onChange={e => setNewRelease(current => ({ ...current, release_date: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>Imagem (URL)<input type="url" style={inputStyle} value={newRelease.image} onChange={e => setNewRelease(current => ({ ...current, image: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>Spotify<input type="url" style={inputStyle} value={newRelease.spotify} onChange={e => setNewRelease(current => ({ ...current, spotify: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13 }}>YouTube<input type="url" style={inputStyle} value={newRelease.youtube} onChange={e => setNewRelease(current => ({ ...current, youtube: e.target.value }))} /></label>
            <label style={{ color: "#ccc", fontSize: 13, gridColumn: "1 / -1" }}>Descrição<textarea maxLength={8000} style={{ ...inputStyle, minHeight: 100 }} value={newRelease.description} onChange={e => setNewRelease(current => ({ ...current, description: e.target.value }))} /></label>
            <div style={{ gridColumn: "1 / -1" }}><button className="btn btn-primary" type="submit">Enviar para aprovação</button></div>
          </form>
        </div>
      </> : <>
        <div style={{ background: "#15151d", border: "1px solid #34343d", borderRadius: 12, padding: 22, marginBottom: 20 }}>
          <h2 style={{ color: "#e9b61e", marginTop: 0 }}>Vinculação do perfil da banda</h2>
          <p style={{ color: "#ccc", lineHeight: 1.7 }}>Por segurança, não é possível escolher uma banda cadastrada nem solicitar acesso diretamente por esta tela. A administração da Comunidade do Rock fará a vinculação manualmente após confirmar qual banda você representa.</p>
          <p style={{ color: "#999", marginBottom: 0 }}>Assim que a administração vincular sua conta ao perfil correto, os dados da banda, lançamentos e eventos ficarão disponíveis neste painel.</p>
        </div>
        <div style={{ background: "#15151d", border: "1px solid #34343d", borderRadius: 12, padding: 22 }}>
          <h2 style={{ color: "#e9b61e", marginTop: 0 }}>Sua banda ainda não está cadastrada?</h2>
          <p style={{ color: "#aaa" }}>Você pode enviar uma nova banda para análise. A vinculação da conta ao perfil será feita separadamente pela administração.</p>
          <Link to="/cadastrar-banda" className="btn btn-primary">Cadastrar banda nova</Link>
        </div>

      </>}
    </div>
  </section>;
}
