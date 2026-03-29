function Contato() {
  return (
    <div>
      {/* CONTATO */}
      <section className="section">
        <div className="section-header">
          <h2>ENTRE EM <span className="highlight">CONTATO</span></h2>
        </div>
        <div style={{maxWidth: "600px", margin: "0 auto", textAlign: "center", color: "#666", padding: "60px 20px"}}>
          <p>Entre em contato conosco para sugestões, parcerias ou dúvidas.</p>
          <form style={{marginTop: "20px"}}>
            <input type="text" placeholder="Nome" style={{width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px"}} />
            <input type="email" placeholder="Email" style={{width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px"}} />
            <textarea placeholder="Mensagem" rows="5" style={{width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px"}}></textarea>
            <button type="submit" className="btn btn-primary">Enviar</button>
          </form>
        </div>
      </section>
    </div>
  );
}

export default Contato;