import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_URL from "./config/api";


function serializeBandMembers(members) {
  return (members || []).filter((member) => member.name.trim()).map((member) => {
    const parts = [member.name.trim()];
    if (member.role.trim()) parts.push(member.role.trim());
    if (member.instagram.trim()) parts.push("@" + member.instagram.trim().replace(/^@/, ""));
    return parts.join(" — ");
  }).join("\n");
}
function instrumentIcon(role) {
  const value = String(role || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/vocal|voz|cantor|cantora|vocalista/.test(value)) return "🎤";
  if (/bateria|baterista|drum|percuss/.test(value)) return "🥁";
  if (/baixo|baixista|bass|guitarra|guitarrista|violao|violonista|cordas/.test(value)) return "🎸";
  if (/teclado|tecladista|piano|sintetizador|synth/.test(value)) return "🎹";
  if (/sax|saxofone|trompete|trombone|flauta|sopro/.test(value)) return "🎷";
  if (/compos|compositor|compositora/.test(value)) return "✍️";
  return "🎵";
}

function CadastrarBanda({ user }) {
  const [form, setForm] = useState({
    name: "",
    genre: "",
    city: "",
    state: "",
    year: "",
    members: "",
    biography: "",
    contact: "",
    instagram: "",
    facebook: "",
    youtube: "",
    spotify: "",
    bandcamp: "",
    site: "",
    image: ""
  });
  const [members, setMembers] = useState([{ name: "", role: "", instagram: "" }]);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm({ ...form, image: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("cdr_session_token");
      if (!token) {
        setMessage("Sua sessão expirou. Entre novamente para cadastrar a banda.");
        return;
      }
      const res = await axios.post(`${API_URL}/api/bands/submit`, { ...form, members: serializeBandMembers(members) }, { headers: { Authorization: `Bearer ${token}` } });
      // A notificação é enviada pelo navegador: o FormSubmit bloqueia chamadas server-to-server da Vercel com HTTP 403.
      try {
        const emailResponse = await fetch("https://formsubmit.co/ajax/comunidadedorock@hotmail.com", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            _subject: "Nova banda aguardando aprovação: " + form.name,
            _template: "table",
            _replyto: form.contact,
            Tipo: "Novo cadastro de banda",
            Banda: form.name,
            Estilo: form.genre,
            Cidade: [form.city, form.state].filter(Boolean).join(" - "),
            "Ano de formação": form.year,
            Integrantes: serializeBandMembers(members),
            "E-mail de contato": form.contact,
            Instagram: form.instagram,
            Facebook: form.facebook,
            YouTube: form.youtube,
            Site: form.site,
            "ID da inscrição": res.data.id || "Verificar painel administrativo"
          })
        });
        const emailResult = await emailResponse.json().catch(() => null);
        if (!emailResponse.ok || !emailResult || emailResult.success === false || emailResult.success === "false") {
          console.error("[Notificação de banda] O FormSubmit não confirmou o envio.", emailResponse.status, emailResult);
        }
      } catch (emailError) {
        console.error("[Notificação de banda] Falha ao enviar e-mail pelo navegador:", emailError);
      }
      setMessage(res.data.message || "Banda cadastrada com sucesso! Aguarde a aprovação.");
      setForm({ name: "", genre: "", city: "", state: "", year: "", members: "", biography: "", contact: "", instagram: "", facebook: "", youtube: "", spotify: "", bandcamp: "", site: "", image: "" });
      setMembers([{ name: "", role: "", instagram: "" }]);
    } catch (err) {
      setMessage("Erro ao cadastrar banda: " + (err.response?.data?.error || err.message));
    }
  };

  if (!user) {
    return (
      <section className="section">
        <div className="section-header"><h2>CADASTRAR <span className="highlight">BANDA</span></h2></div>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "30px 20px 60px", textAlign: "center" }}>
          <div style={{ background: "#151515", border: "1px solid #333", borderRadius: 12, padding: "30px 24px" }}>
            <h3 style={{ color: "#fff", marginTop: 0 }}>Entre na sua conta para cadastrar sua banda</h3>
            <p style={{ color: "#bbb", lineHeight: 1.7 }}>Faça login ou crie uma conta grátis para enviar os dados da sua banda para aprovação.</p>
            <Link to="/login" style={{ display: "inline-block", marginTop: 12, padding: "12px 24px", borderRadius: 6, background: "#e31b23", color: "#fff", textDecoration: "none", fontWeight: 800 }}>ENTRAR OU CRIAR CONTA</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div>
      {/* CADASTRAR BANDA */}
      <section className="section">
        <div className="section-header">
          <h2>CADASTRAR <span className="highlight">BANDA</span></h2>
        </div>
        <style>{`
        .band-form-shell { max-width: 780px; margin: 0 auto; padding: 10px 20px 45px; }
        .band-form-card { background: linear-gradient(145deg,#171717,#0d0d0d); border: 1px solid #303030; border-radius: 14px; padding: 30px; box-shadow: 0 16px 45px rgba(0,0,0,.3); }
        .band-form-card form { display: flex; flex-direction: column; gap: 2px; }
        .band-form-card input, .band-form-card textarea { box-sizing: border-box !important; min-width: 0; max-width: 100%; width: 100% !important; min-height: 46px; padding: 12px 14px !important; border: 1px solid #3a3a3a !important; border-radius: 7px !important; background: #101010 !important; color: #fff !important; font: inherit; outline: none; transition: .2s; }
        .band-form-card input:focus, .band-form-card textarea:focus { border-color: #e31b23 !important; box-shadow: 0 0 0 3px rgba(227,27,35,.13); background: #151515 !important; }
        .band-form-card input::placeholder, .band-form-card textarea::placeholder { color: #999; opacity: 1; font-size: 13px; letter-spacing: -0.2px; }\n        .band-form-card input { font-size: 14px; }\n        .band-form-card input[type="email"], .band-form-card input[type="url"] { font-size: 13px; }\n        .band-form-card input[type="number"] { min-width: 0; }\n        .band-form-card form > div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; }\n        .band-form-card form > div[style*="repeat(auto-fit, minmax(150px, 1fr))"] { min-width: 0; }
        .band-form-card textarea { min-height: 135px; resize: vertical; line-height: 1.5; }
        .band-form-card h3 { color:#fff; font-size:18px; margin:24px 0 14px; padding-top:22px; border-top:1px solid #292929; }
        .band-form-card h3::before { content:""; display:inline-block; width:4px; height:20px; margin-right:9px; vertical-align:-4px; border-radius:3px; background:#e31b23; }
        .band-form-card h3:first-of-type { margin-top:0; padding-top:0; border-top:0; }
        .band-form-card input[type="file"] { min-height:auto; padding:16px !important; border:1px dashed #4b4b4b !important; cursor:pointer; }
        .band-form-card img { border:1px solid #333; border-radius:9px; box-shadow:0 8px 24px rgba(0,0,0,.25); }
        .band-form-card button[type="submit"] { width:100% !important; min-height:50px; margin-top:18px; border:0 !important; border-radius:7px !important; background:#e31b23 !important; color:#fff !important; font-weight:800; font-size:15px; cursor:pointer; transition:.2s; }
        .band-form-card button[type="submit"]:hover { background:#c9151c !important; transform:translateY(-1px); box-shadow:0 8px 24px rgba(227,27,35,.2); }
        .band-form-card > form > div:first-child { padding:20px; border:1px dashed #444; border-radius:10px; background:#111; }
        @media(max-width:640px){ .band-form-shell{padding:5px 10px 30px;} .band-form-card{padding:20px 15px;} .band-form-card h3{font-size:16px;} }
`}</style>
        <div className="band-form-shell"><div className="band-form-card">
          <form onSubmit={handleSubmit}>
            <div style={{marginBottom: "12px"}}>
              <label style={{display: "block", marginBottom: "6px", fontWeight: "bold"}}>Foto da Banda</label>
              <input type="file" accept="image/*" onChange={handleFileChange} style={{width: "100%"}} />
              {form.image && <img src={form.image} alt="Preview" style={{marginTop: "8px", width: "100%", maxHeight: "320px", height: "auto", objectFit: "contain", objectPosition: "center", borderRadius: "8px", background: "#0b0b0f"}} />}
            </div>

            <input
              type="text"
              name="name"
              placeholder="Nome da banda"
              value={form.name}
              onChange={handleChange}
              required
              style={{width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
            />
            <input
              type="text"
              name="genre"
              placeholder="Gênero musical"
              value={form.genre}
              onChange={handleChange}
              required
              style={{width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
            />
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px"}}>
              <input
                type="text"
                name="city"
                placeholder="Cidade"
                value={form.city}
                onChange={handleChange}
                required
                style={{padding: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
              />
              <input
                type="text"
                name="state"
                placeholder="Estado"
                value={form.state}
                onChange={handleChange}
                required
                style={{padding: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
              />
            </div>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px"}}>
              <input
                type="number"
                name="year"
                placeholder="Ano de Formação"
                value={form.year}
                onChange={handleChange}
                required
                style={{padding: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
              />
              <input
                type="email"
                name="contact"
                placeholder="Email de Contato"
                value={form.contact}
                onChange={handleChange}
                required
                style={{padding: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
              />
            </div>
            <h3>Integrantes da banda — cadastre cada integrante separadamente</h3>
            <div style={{display: "grid", gap: "10px", marginBottom: "14px"}}>
              {members.map((member, index) => (
                <div key={index} style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px", padding: "12px", border: "1px solid #444", borderRadius: "8px", background: "#111"}}>
                  <input aria-label={`Nome do integrante ${index + 1}`} value={member.name} onChange={(e) => setMembers(current => current.map((item, i) => i === index ? {...item, name: e.target.value} : item))} placeholder="Nome do integrante" />
                  <input aria-label={`Instrumento de ${member.name || index + 1}`} value={member.role} onChange={(e) => setMembers(current => current.map((item, i) => i === index ? {...item, role: e.target.value} : item))} placeholder="Instrumento / função" />
                  <input aria-label={`Instagram de ${member.name || index + 1}`} value={member.instagram} onChange={(e) => setMembers(current => current.map((item, i) => i === index ? {...item, instagram: e.target.value} : item))} placeholder="Instagram (opcional, @perfil)" />
                  <div style={{display: "flex", alignItems: "center", gap: "8px"}}>
                    <span title="Ícone identificado automaticamente" style={{fontSize: "22px"}}>{instrumentIcon(member.role)}</span>
                    <button type="button" className="btn btn-secondary" disabled={members.length === 1} onClick={() => setMembers(current => current.filter((_, i) => i !== index))}>Remover</button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-secondary" onClick={() => setMembers(current => [...current, {name: "", role: "", instagram: ""}])}>+ Adicionar integrante</button>
              <small style={{color: "#aaa"}}>Cadastre cada integrante separadamente. O ícone acompanha o instrumento ou função informado; Instagram é opcional.</small>
            </div>
            <textarea
              name="biography"
              placeholder="Biografia"
              value={form.biography}
              onChange={handleChange}
              rows="4"
              style={{width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
            ></textarea>
            <h3 style={{marginBottom: "10px", fontSize: "18px", color: "#fff"}}>Links de Divulgação</h3>
            <input
              type="url"
              name="instagram"
              placeholder="Instagram (opcional)"
              value={form.instagram}
              onChange={handleChange}
              style={{width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
            />
            <input
              type="url"
              name="facebook"
              placeholder="Facebook (opcional)"
              value={form.facebook}
              onChange={handleChange}
              style={{width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
            />
            <input
              type="url"
              name="youtube"
              placeholder="YouTube (opcional)"
              value={form.youtube}
              onChange={handleChange}
              style={{width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
            />
            <input
              type="url"
              name="spotify"
              placeholder="Spotify (opcional)"
              value={form.spotify}
              onChange={handleChange}
              style={{width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
            />
            <input
              type="url"
              name="bandcamp"
              placeholder="Bandcamp (opcional)"
              value={form.bandcamp}
              onChange={handleChange}
              style={{width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
            />
            <input
              type="url"
              name="site"
              placeholder="Site (opcional)"
              value={form.site}
              onChange={handleChange}
              style={{width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
            />
            <button type="submit" className="btn btn-primary" style={{width: "100%"}}>Cadastrar banda</button>
          </form>
          {message && <p style={{marginTop: "20px", textAlign: "center", color: message.includes("Erro") ? "red" : "green"}}>{message}</p>}
        </div></div>
      </section>
    </div>
  );
}

export default CadastrarBanda;
