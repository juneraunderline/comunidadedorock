import { useState } from "react";

function Contato() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    marginBottom: "14px",
    background: "#10101a",
    border: "1px solid #2a2a33",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "14px",
    fontFamily: "inherit"
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await fetch("https://formsubmit.co/ajax/junior.lopes@yahoo.com", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          assunto,
          mensagem,
          _subject: "Novo contato - Comunidade do Rock",
          _template: "table"
        })
      });
      setSent(true);
      setNome("");
      setEmail("");
      setAssunto("");
      setMensagem("");
    } catch (err) {
      alert("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div>
        <section className="section">
          <div className="section-header">
            <h2>ENTRE EM <span className="highlight">CONTATO</span></h2>
          </div>
          <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "60px", marginBottom: "20px" }}>🎸</div>
            <h3 style={{ color: "#e9b61e", marginBottom: "12px" }}>Mensagem enviada!</h3>
            <p style={{ color: "#999", marginBottom: "24px" }}>Obrigado por entrar em contato. Responderemos em breve!</p>
            <button className="btn btn-primary" onClick={() => setSent(false)}>Enviar outra mensagem</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      {/* CONTATO */}
      <section className="section">
        <div className="section-header">
          <h2>ENTRE EM <span className="highlight">CONTATO</span></h2>
        </div>
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center", padding: "20px 20px" }}>
          <div style={{ marginBottom: "32px", padding: "24px", background: "#16161b", borderRadius: "8px", border: "1px solid #2a2a33", textAlign: "center" }}>
            <p style={{ color: "#e9b61e", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase", fontSize: "13px", letterSpacing: "1px" }}>Canais Oficiais</p>
            <p style={{ color: "#ccc", fontSize: "14px", lineHeight: "1.6" }}>Para parcerias, sugestões de pauta ou remoção de conteúdo, você também pode enviar um e-mail direto para:<br />
            <a href="mailto:junior.lopes@yahoo.com" style={{ color: "#fff", textDecoration: "underline", fontWeight: "700" }}>junior.lopes@yahoo.com</a></p>
          </div>
          <p style={{ color: "#999", marginBottom: "24px" }}>Ou utilize o formulário abaixo para nos enviar uma mensagem rápida:</p>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Seu nome"
              required
              value={nome}
              onChange={e => setNome(e.target.value)}
              style={inputStyle}
            />
            <input
              type="email"
              placeholder="Seu email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Assunto"
              value={assunto}
              onChange={e => setAssunto(e.target.value)}
              style={inputStyle}
            />
            <textarea
              placeholder="Sua mensagem..."
              rows="6"
              required
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
            ></textarea>
            <button
              type="submit"
              disabled={sending}
              className="btn btn-primary"
              style={{ width: "100%", padding: "14px", fontSize: "14px", fontWeight: "700", letterSpacing: "1px", opacity: sending ? 0.7 : 1 }}
            >
              {sending ? "Enviando..." : "🚀 Enviar Mensagem"}
            </button>
          </form>
          <p style={{ color: "#555", fontSize: "11px", marginTop: "16px" }}>
            Suas informações são seguras e não serão compartilhadas.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Contato;