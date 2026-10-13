import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_URL from "./config/api";

function CadastrarEvento({ user }) {
  const emptySubmission = { title: "", artist: "", date: "", time: "", location: "", city: "", state: "", image: "", ticket_link: "", ticket_location: "", description: "", contact_email: "" };
  const [submission, setSubmission] = useState(emptySubmission);
  const [sending, setSending] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const fields = [
    ["title", "Nome do evento (opcional)", "Ex.: Festival Rock Independente", "text", false],
    ["artist", "Bandas / artistas *", "Digite uma banda por linha. Pode incluir quantas bandas quiser.", "textarea", true],
    ["date", "Data do evento *", "", "date", true],
    ["time", "Horário de início", "", "time", false],
    ["location", "Local do show / casa de shows", "Ex.: Hangar 110", "text", false],
    ["city", "Cidade", "Ex.: São Paulo", "text", false],
    ["state", "Estado", "Ex.: SP", "text", false],
    ["ticket_location", "Ponto físico de venda de ingressos (opcional)", "Ex.: loja, bar ou endereço de venda", "text", false],
    ["ticket_link", "Link para comprar ingressos (opcional)", "https://...", "url", false],
    ["contact_email", "E-mail para contato *", "email@exemplo.com", "email", true],
    ["image", "Link do cartaz (opcional)", "https://...", "url", false]
  ];

  const inputStyle = { boxSizing: "border-box", width: "100%", padding: "11px", border: "1px solid #454552", borderRadius: "5px", background: "#20202b", color: "#fff" };
  const labelStyle = { display: "flex", flexDirection: "column", gap: "6px", color: "#ddd", fontSize: "13px" };

  return (
    <section className="section section-dark">
      <div className="section-header"><h2>CADASTRAR <span className="highlight">EVENTO</span></h2></div>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px", background: "#15151f", border: "1px solid #343442", borderRadius: "10px" }}>
        {user ? <>
          <p style={{ color: "#aaa", lineHeight: 1.6 }}>Cadastre seu show gratuitamente. Nossa equipe revisará as informações antes da publicação.</p>
          <form onSubmit={async (e) => {
            e.preventDefault(); setSending(true); setSubmitMessage("");
            try {
              const response = await axios.post(API_URL + "/api/event-submissions", submission);
              setSubmitMessage(response.data.message || "Evento enviado para análise da administração!");
              setSubmission(emptySubmission);
            } catch (error) {
              setSubmitMessage(error.response?.data?.error || "Não foi possível enviar agora. Tente novamente.");
            } finally { setSending(false); }
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              {fields.map(([field, label, placeholder, type, required]) => <label key={field} style={labelStyle}>
                {label}
                {type === "textarea" ? <>
                  <textarea required={required} rows={3} value={submission[field]} placeholder={placeholder} onChange={e => setSubmission({ ...submission, [field]: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
                  <small style={{ color: "#999" }}>Informe uma banda por linha. Se houver várias, todas serão exibidas no evento.</small>
                </> : <input type={type} required={required} value={submission[field]} placeholder={placeholder} onChange={e => setSubmission({ ...submission, [field]: e.target.value })} style={inputStyle} />}
              </label>)}
            </div>
            <label style={{ ...labelStyle, marginTop: "14px" }}>Descrição do evento
              <textarea rows={4} maxLength={3000} value={submission.description} placeholder="Conte um pouco sobre o show, atrações e informações importantes..." onChange={e => setSubmission({ ...submission, description: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
            </label>
            <button type="submit" disabled={sending} className="btn btn-primary" style={{ marginTop: "16px", opacity: sending ? 0.7 : 1 }}>{sending ? "ENVIANDO..." : "ENVIAR PARA APROVAÇÃO"}</button>
            {submitMessage && <p role="status" style={{ color: submitMessage.toLowerCase().includes("não foi") || submitMessage.toLowerCase().includes("válido") || submitMessage.toLowerCase().includes("preencha") ? "#ff8b8b" : "#9fda9f" }}>{submitMessage}</p>}
          </form>
        </> : <div style={{ textAlign: "center", padding: "8px 4px" }}>
          <h3 style={{ color: "#e9b61e", marginTop: 0 }}>Entre para cadastrar um evento</h3>
          <p style={{ color: "#ccc", lineHeight: 1.7 }}>Para enviar um show para a agenda, entre na sua conta ou crie um cadastro gratuito.</p>
          <Link to="/login" className="btn btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>ENTRAR / CRIAR CONTA</Link>
        </div>}
        <div style={{ marginTop: "22px", textAlign: "center" }}><Link to="/eventos" style={{ color: "#e9b61e" }}>← Voltar para os eventos</Link></div>
      </div>
    </section>
  );
}

export default CadastrarEvento;
