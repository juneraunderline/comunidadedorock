import { useState } from "react";
import axios from "axios";

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
      const res = await axios.post("http://https://comunidadedorock.onrender.com/api/bands/submit", form);
      setMessage(res.data.message);
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
      setMessage("Erro ao cadastrar banda.");
    }
  };

  return (
    <div>
      {/* CADASTRAR BANDA */}
      <section className="section">
        <div className="section-header">
          <h2>CADASTRAR <span className="highlight">BANDA</span></h2>
        </div>
        <div style={{maxWidth: "600px", margin: "0 auto", padding: "20px"}}>
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