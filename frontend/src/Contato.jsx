import { useState } from "react";

function Contato() {
  const [sent, setSent] = useState(false);

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

  if (sent) {
    return (
      <div>
        <section className="section">
          <div className="section-header">
            <h2>ENTRE EM <span className="highlight">CONTATO</span></h2>
          </div>
          <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "60px", marginBottom: "20px" }}>🎸</div>
            <h3 style={{ color: "#e91e63", marginBottom: "12px" }}>Mensagem enviada!</h3>
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
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center", padding: "60px 20px" }}>
          <p style={{ color: "#999", marginBottom: "24px" }}>Entre em contato conosco para sugestões, parcerias ou dúvidas.</p>
          <form
            action="https://formsubmit.co/junior.lopes@yahoo.com"
            method="POST"
            onSubmit={() => {
              setTimeout(() => setSent(true), 100);
            }}
          >
            {/* FormSubmit configs */}
            <input type="hidden" name="_subject" value="Novo contato - Comunidade do Rock" />
            <input type="hidden" name="_captcha" value="false" />
            <input type="hidden" name="_template" value="table" />
            <input type="hidden" name="_next" value="https://comunidadedorock.vercel.app/contato" />
            <input type="text" name="_honey" style={{ display: "none" }} />

            <input
              type="text"
              name="nome"
              placeholder="Seu nome"
              required
              style={inputStyle}
            />
            <input
              type="email"
              name="email"
              placeholder="Seu email"
              required
              style={inputStyle}
            />
            <input
              type="text"
              name="assunto"
              placeholder="Assunto"
              style={inputStyle}
            />
            <textarea
              name="mensagem"
              placeholder="Sua mensagem..."
              rows="6"
              required
              style={{ ...inputStyle, resize: "vertical" }}
            ></textarea>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", padding: "14px", fontSize: "14px", fontWeight: "700", letterSpacing: "1px" }}
            >
              🚀 Enviar Mensagem
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