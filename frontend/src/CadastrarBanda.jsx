import { useState } from "react";
import axios from "axios";
import API_URL from "./config/api";

function CadastrarBanda() {
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
      const res = await axios.post(`${API_URL}/api/bands/submit`, form);
      setMessage(res.data.message || "Banda cadastrada com sucesso! Aguarde a aprovação.");
      setForm({
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
    } catch (err) {
      setMessage("Erro ao cadastrar banda: " + (err.response?.data?.error || err.message));
    }
  };

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
        .band-form-card input, .band-form-card textarea { box-sizing: border-box !important; width: 100% !important; min-height: 46px; padding: 12px 14px !important; border: 1px solid #3a3a3a !important; border-radius: 7px !important; background: #101010 !important; color: #fff !important; font: inherit; outline: none; transition: .2s; }
        .band-form-card input:focus, .band-form-card textarea:focus { border-color: #e31b23 !important; box-shadow: 0 0 0 3px rgba(227,27,35,.13); background: #151515 !important; }
        .band-form-card input::placeholder, .band-form-card textarea::placeholder { color: #777; }
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
`}</style>\n        <div className="band-form-shell"><div className="band-form-card">
          <form onSubmit={handleSubmit}>
            <div style={{marginBottom: "12px"}}>
              <label style={{display: "block", marginBottom: "6px", fontWeight: "bold"}}>Foto da Banda</label>
              <input type="file" accept="image/*" onChange={handleFileChange} style={{width: "100%"}} />
              {form.image && <img src={form.image} alt="Preview" style={{marginTop: "8px", width: "100%", maxHeight: "250px", objectFit: "cover", borderRadius: "8px"}} />}
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
            <input
              type="text"
              name="members"
              placeholder="Membros (Ex: João (Voz), Maria (Guitarra), Pedro (Baixo))"
              value={form.members}
              onChange={handleChange}
              required
              style={{width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px", background: "#111", color: "#fff"}}
            />
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
        </div>
      </section>
    </div>
  );
}

export default CadastrarBanda;
