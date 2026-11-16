import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_URL from "./config/api";

function CadastrarEvento({ user }) {
  const emptySubmission = { title: "", artist: "", date: "", time: "", location: "", city: "", state: "", image: "", ticket_link: "", ticket_location: "", description: "", contact_email: "" };
  const [submission, setSubmission] = useState(emptySubmission);
  const [sending, setSending] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState("");

  const handlePosterUpload = async (file) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { setSubmitMessage("Use uma imagem JPG, PNG, WebP ou GIF."); return; }
    if (file.size > 6 * 1024 * 1024) { setSubmitMessage("O cartaz deve ter no máximo 6 MB."); return; }
    setUploadingImage(true); setSubmitMessage("");
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
        reader.readAsDataURL(file);
      });
      const response = await axios.post(API_URL + "/api/event-upload-image", { image: dataUrl });
      const imageUrl = response.data?.path;
      if (!imageUrl) throw new Error("O servidor não retornou o endereço da imagem.");
      setSubmission(prev => ({ ...prev, image: imageUrl }));
      setImagePreview(imageUrl);
      setSubmitMessage("Cartaz enviado! A imagem será anexada ao evento quando você enviar o cadastro.");
    } catch (error) {
      setSubmitMessage(error.response?.data?.error || error.message || "Não foi possível enviar o cartaz.");
    } finally { setUploadingImage(false); }
  };

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
              // Enviar a notificação no navegador evita o bloqueio HTTP 403 do FormSubmit nas chamadas server-to-server da Vercel.
              try {
                const emailResponse = await fetch("https://formsubmit.co/ajax/comunidadedorock@hotmail.com", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Accept": "application/json" },
                  body: JSON.stringify({
                    _subject: "Novo evento aguardando aprovação: " + (submission.title || submission.artist || "Evento"),
                    _template: "table",
                    _replyto: submission.contact_email,
                    Tipo: "Novo cadastro de evento",
                    Evento: submission.title || "Não informado",
                    "Bandas / artistas": submission.artist,
                    Data: submission.date,
                    Horário: submission.time,
                    Local: submission.location,
                    Cidade: [submission.city, submission.state].filter(Boolean).join(" - "),
                    "E-mail de contato": submission.contact_email,
                    "Link de ingressos": submission.ticket_link,
                    "Ponto de venda": submission.ticket_location,
                    Descrição: submission.description
                  })
                });
                const emailResult = await emailResponse.json().catch(() => null);
                if (!emailResponse.ok || !emailResult || emailResult.success === false || emailResult.success === "false") {
                  console.error("[Notificação de evento] O FormSubmit não confirmou o envio.", emailResponse.status, emailResult);
                }
              } catch (emailError) {
                console.error("[Notificação de evento] Falha ao enviar e-mail pelo navegador:", emailError);
              }
              setSubmitMessage(response.data.message || "Evento enviado para análise da administração!");
              setSubmission(emptySubmission); setImagePreview("");
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
            <div style={{ ...labelStyle, marginTop: "14px" }}>
              Cartaz do evento (opcional)
              <input type="url" value={submission.image.startsWith("https://") || submission.image.startsWith("http://") ? submission.image : ""} onChange={e => { setSubmission(prev => ({ ...prev, image: e.target.value })); setImagePreview(e.target.value); }} placeholder="Cole o link do cartaz, se preferir" style={inputStyle} />
              <label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "11px 14px", border: "1px solid #e9b61e", borderRadius: "6px", color: "#e9b61e", cursor: uploadingImage ? "wait" : "pointer", fontWeight: 700, opacity: uploadingImage ? 0.65 : 1 }}>
                {uploadingImage ? "ENVIANDO CARTAZ..." : "📤 ESCOLHER CARTAZ DO CELULAR OU PC"}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploadingImage} onChange={e => { handlePosterUpload(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
              </label>
              <small style={{ color: "#999" }}>JPG, PNG, WebP ou GIF · até 6 MB.</small>
              {imagePreview && <img src={imagePreview} alt="Prévia do cartaz do evento" style={{ display: "block", width: "100%", maxWidth: "320px", maxHeight: "420px", objectFit: "contain", objectPosition: "center", marginTop: "8px", borderRadius: "8px", background: "#0b0b0f" }} onError={() => setImagePreview("")} />}
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
