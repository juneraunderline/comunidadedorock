function Sobre() {
  return (
    <div>
      <section className="section">
        <div className="section-header">
          <h2>SOBRE A <span className="highlight">COMUNIDADE DO ROCK</span></h2>
        </div>
        <div style={{ maxWidth: "800px", margin: "0 auto", color: "#ccc", lineHeight: "1.9", fontSize: "15px" }}>

          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <p style={{ fontSize: "20px", color: "#e9b61e", fontWeight: "700" }}>🎸 O melhor do rock underground brasileiro em um só lugar</p>
          </div>

          <h3 style={{ color: "#e9b61e", margin: "32px 0 12px", fontSize: "20px" }}>Quem somos</h3>
          <p>A <strong>Comunidade do Rock</strong> é uma plataforma brasileira dedicada a promover e fortalecer a cena do rock independente no Brasil. Nascemos da paixão pela música e da vontade de dar visibilidade às bandas que fazem o rock acontecer de verdade — nos palcos, nos ensaios, nas garagens.</p>

          <h3 style={{ color: "#e9b61e", margin: "32px 0 12px", fontSize: "20px" }}>Nossa missão</h3>
          <p>Conectar fãs, bandas e a cena do rock brasileiro em uma plataforma única, oferecendo:</p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li><strong style={{ color: "#e9b61e" }}>Notícias</strong> — Curadoria das principais notícias do mundo do rock, reunidas dos melhores portais especializados, além de conteúdo original produzido pela nossa equipe</li>
            <li><strong style={{ color: "#e9b61e" }}>Bandas</strong> — Espaço para bandas independentes se cadastrarem e ganharem visibilidade, com perfis completos incluindo biografia, redes sociais e links de streaming</li>
            <li><strong style={{ color: "#e9b61e" }}>Entrevistas</strong> — Conversas exclusivas com artistas e bandas da cena underground</li>
            <li><strong style={{ color: "#e9b61e" }}>Eventos</strong> — Agenda atualizada de shows e festivais de rock pelo Brasil</li>
          </ul>

          <h3 style={{ color: "#e9b61e", margin: "32px 0 12px", fontSize: "20px" }}>Como funcionam as notícias</h3>
          <p>Nosso site reúne notícias de duas formas:</p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li><strong>Curadoria automática</strong> — Importamos notícias de portais especializados em rock e música através de feeds RSS, sempre creditando a fonte original e fornecendo link para o conteúdo completo</li>
            <li><strong>Conteúdo original</strong> — Nossa equipe editorial também publica notícias, resenhas e conteúdos exclusivos sobre a cena do rock</li>
          </ul>

          <h3 style={{ color: "#e9b61e", margin: "32px 0 12px", fontSize: "20px" }}>Para bandas</h3>
          <p>Se você tem uma banda de rock e quer divulgar seu trabalho, a Comunidade do Rock é o lugar certo. Cadastre sua banda gratuitamente e alcance novos fãs. Aceitamos bandas de todos os subgêneros do rock — do punk ao metal, do indie ao progressivo.</p>

          <h3 style={{ color: "#e9b61e", margin: "32px 0 12px", fontSize: "20px" }}>Contato</h3>
          <p>Quer falar com a gente? Sugestões, parcerias, divulgação de eventos ou qualquer outra coisa — estamos sempre abertos. Acesse nossa página de <a href="/contato" style={{ color: "#e9b61e" }}>Contato</a>.</p>

          <div style={{ textAlign: "center", marginTop: "48px", padding: "30px", background: "#16161b", borderRadius: "8px", border: "1px solid #2a2a33" }}>
            <p style={{ fontSize: "16px", color: "#fff", marginBottom: "8px", fontWeight: "700" }}>🤘 Rock nunca morre.</p>
            <p style={{ color: "#888", fontSize: "13px" }}>Comunidade do Rock — Desde 2026</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Sobre;
