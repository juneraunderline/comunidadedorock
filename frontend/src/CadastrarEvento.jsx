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
  const [instagramUrl, setInstagramUrl] = useState("");
  const [importingInstagram, setImportingInstagram] = useState(false);
  const [importingFlyer, setImportingFlyer] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  const handlePosterUpload = async (file) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { setSubmitMessage("Use uma imagem JPG, PNG, WebP ou GIF."); return; }
    if (file.size > 3 * 1024 * 1024) { setSubmitMessage("O cartaz deve ter no máximo 3 MB."); return; }
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

  const handleInstagramImport = async () => {
    if (!instagramUrl.trim()) { setSubmitMessage("Cole o link da publicação do Instagram."); return; }
    setImportingInstagram(true); setSubmitMessage("");
    try {
      const response = await axios.post(API_URL + "/api/event-instagram-import", { url: instagramUrl.trim() });
      const imported = response.data || {};
      setSubmission(prev => {
        const next = { ...prev };
        ["title", "artist", "date", "time", "location", "city", "state", "image", "description"].forEach(key => {
          if (imported[key] && !String(prev[key] || "").trim()) next[key] = imported[key];
        });
        return next;
      });
      if (imported.image && !submission.image.trim()) setImagePreview(imported.image);
      const found = [imported.imported?.caption && "legenda", imported.imported?.image && "cartaz", imported.imported?.date && "data", imported.imported?.time && "horário", imported.imported?.location && "local"].filter(Boolean);
      setSubmitMessage(found.length
        ? "Importação concluída! Encontramos: " + found.join(", ") + ". Confira e complete os campos que ficaram vazios."
        : "A publicação foi acessada, mas não encontramos informações suficientes. Confira a legenda e complete os campos manualmente.");
    } catch (error) {
      setSubmitMessage(error.response?.data?.error || "Não foi possível importar. Você pode preencher os dados e enviar o cartaz manualmente.");
    } finally { setImportingInstagram(false); }
  };

  const handleFlyerImport = async (file) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { setSubmitMessage("Para reconhecer o texto, envie um print ou cartaz JPG, PNG ou WebP."); return; }
    if (file.size > 3 * 1024 * 1024) { setSubmitMessage("A imagem deve ter no máximo 3 MB."); return; }
    setImportingFlyer(true); setOcrProgress(0); setSubmitMessage("Preparando o reconhecimento do cartaz...");
    let worker;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("por", 1, {
        logger: (info) => {
          if (info.status === "recognizing text" && Number.isFinite(info.progress)) {
            setOcrProgress(Math.round(info.progress * 100));
          }
        }
      });
      const result = await worker.recognize(file);
      const recognized = String(result.data?.text || "").replace(/\r/g, "").trim();
      if (recognized.length < 8) throw new Error("Não conseguimos ler texto suficiente. Tente uma imagem mais nítida e com o texto maior.");

      const lines = recognized.split(/\n+/).map(line => line.replace(/[|_]+/g, " ").replace(/\s+/g, " ").trim()).filter(line => line.length > 2);
      const normalized = recognized.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const months = { janeiro: "01", fevereiro: "02", marco: "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12" };
      let date = "";
      const numericDate = recognized.match(/\b(\d{1,2})[/. -](\d{1,2})[/. -](20\d{2})\b/);
      const namedDate = normalized.match(/\b(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(20\d{2}))?\b/);
      if (numericDate) date = numericDate[3] + "-" + numericDate[2].padStart(2, "0") + "-" + numericDate[1].padStart(2, "0");
      else if (namedDate) date = (namedDate[3] || String(new Date().getFullYear())) + "-" + months[namedDate[2]] + "-" + namedDate[1].padStart(2, "0");

      const timeMatch = normalized.match(/\b(?:as|a partir das|inicio as|comeca as|horario:?\s*)?(\d{1,2})\s*(?:h|:)(\d{2})?\b/);
      const time = timeMatch ? timeMatch[1].padStart(2, "0") + ":" + (timeMatch[2] || "00") : "";
      const findLine = (pattern) => lines.find(line => pattern.test(line)) || "";
      const labeledArtist = findLine(/^(?:bandas?|artistas?|atracoes?|line\s*up)\s*:/i).replace(/^(?:bandas?|artistas?|atrações?|line\s*up)\s*:/i, "").trim();
      const labeledLocation = findLine(/^(?:local|endereco|endereço|onde|casa de shows|venue)\s*:/i).replace(/^(?:local|endereço|endereco|onde|casa de shows|venue)\s*:/i, "").trim();
      const cityLine = findLine(/\b[A-Z]{2}\b/);
      const cityMatch = cityLine.match(/([A-Za-zÀ-ÿ .'-]{2,})\s*[-/]\s*([A-Z]{2})\b/);
      const ignored = /^(?:ingressos?|entrada|classificacao|classificação|informacoes?|informações|realizacao|realização|apoio|patrocinio|patrocínio|reservas?|www\.|https?:)/i;
      const title = lines.find(line => !ignored.test(line) && !/\d{1,2}[/. -]\d{1,2}/.test(line) && line.length >= 4) || "";
      const details = {
        title: title.slice(0, 180), artist: labeledArtist.slice(0, 500), date, time,
        location: labeledLocation.slice(0, 240),
        city: cityMatch ? cityMatch[1].trim() : "",
        state: cityMatch ? cityMatch[2].trim() : "",
        description: recognized.slice(0, 3000)
      };
      setSubmission(prev => {
        const next = { ...prev };
        Object.entries(details).forEach(([key, value]) => {
          if (value && !String(prev[key] || "").trim()) next[key] = value;
        });
        return next;
      });
      await handlePosterUpload(file);
      const labels = { title: "nome", artist: "bandas/artistas", date: "data", time: "horário", location: "local", city: "cidade", state: "estado" };
      const found = Object.entries(details).filter(([key, value]) => value && key !== "description").map(([key]) => labels[key]);
      setSubmitMessage("Leitura concluída! " + (found.length ? "Identificamos: " + found.join(", ") + ". " : "") + "O texto reconhecido foi colocado na descrição. Confira e corrija os campos antes de enviar.");
    } catch (error) {
      setSubmitMessage(error.message || "Não foi possível reconhecer o texto desta imagem. Tente outra imagem ou preencha os dados manualmente.");
    } finally {
      if (worker) await worker.terminate().catch(() => {});
      setImportingFlyer(false); setOcrProgress(0);
    }
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
          <div style={{ margin: "18px 0 22px", padding: "16px", border: "1px solid #55451b", borderRadius: "8px", background: "#1d1b16" }}>
            <label style={{ ...labelStyle, fontWeight: 700, color: "#e9b61e" }}>
              IMPORTAR DE UMA PUBLICAÇÃO DO INSTAGRAM
              <input type="url" value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="Cole aqui o link do post ou Reel" style={{ ...inputStyle, marginTop: "5px", fontWeight: 400 }} />
            </label>
            <button type="button" onClick={handleInstagramImport} disabled={importingInstagram || importingFlyer || uploadingImage} className="btn btn-primary" style={{ marginTop: "10px", opacity: importingInstagram ? 0.7 : 1 }}>
              {importingInstagram ? "BUSCANDO PUBLICAÇÃO..." : "📥 IMPORTAR INFORMAÇÕES E CARTAZ"}
            </button>
            <small style={{ display: "block", marginTop: "8px", color: "#aaa", lineHeight: 1.5 }}>A publicação precisa ser pública. O Instagram pode limitar a leitura automática; se isso acontecer, você ainda poderá enviar o cartaz pelo celular e preencher os dados manualmente.</small>
          </div>
          <div style={{ margin: "0 0 22px", padding: "16px", border: "1px solid #454552", borderRadius: "8px", background: "#191923" }}>
            <label style={{ ...labelStyle, fontWeight: 700, color: "#e9b61e" }}>
              OU IMPORTAR DE UM PRINT / CARTAZ
              <span style={{ color: "#bbb", fontWeight: 400, lineHeight: 1.5 }}>Envie uma captura de tela da publicação ou a imagem do flyer. O reconhecimento tenta ler os textos e preencher os campos para você revisar.</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={importingFlyer || uploadingImage} onChange={e => { handleFlyerImport(e.target.files?.[0]); e.target.value = ""; }} style={{ ...inputStyle, marginTop: "8px" }} />
            </label>
            {importingFlyer && <div role="status" style={{ marginTop: "10px", color: "#e9b61e", fontSize: "13px" }}>Lendo o cartaz... {ocrProgress}%</div>}
            <small style={{ display: "block", marginTop: "8px", color: "#999", lineHeight: 1.5 }}>JPG, PNG ou WebP · até 3 MB. Imagens nítidas dão melhores resultados. Informações que não estiverem visíveis não serão inventadas.</small>
          </div>
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
              setSubmission(emptySubmission); setImagePreview(""); setInstagramUrl("");
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
              <small style={{ color: "#999" }}>JPG, PNG, WebP ou GIF · até 3 MB.</small>
              {imagePreview && <img src={imagePreview} alt="Prévia do cartaz do evento" style={{ display: "block", width: "100%", maxWidth: "320px", maxHeight: "420px", objectFit: "contain", objectPosition: "center", marginTop: "8px", borderRadius: "8px", background: "#0b0b0f" }} onError={() => setImagePreview("")} />}
            </div>
            <label style={{ ...labelStyle, marginTop: "14px" }}>Descrição do evento
              <textarea rows={4} maxLength={3000} value={submission.description} placeholder="Conte um pouco sobre o show, atrações e informações importantes..." onChange={e => setSubmission({ ...submission, description: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
            </label>
            <button type="submit" disabled={sending || importingFlyer || uploadingImage} className="btn btn-primary" style={{ marginTop: "16px", opacity: sending ? 0.7 : 1 }}>{uploadingImage ? "AGUARDE O ENVIO DO CARTAZ..." : sending ? "ENVIANDO..." : "ENVIAR PARA APROVAÇÃO"}</button>
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
