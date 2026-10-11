import React from "react";

const sections = [
  {
    title: "Monte um kit de divulgação que resolva as dúvidas básicas",
    paragraphs: [
      "Imagine que uma casa de shows recebeu sua mensagem entre dezenas de outras. A pessoa precisa descobrir rapidamente quem é a banda, que som ela faz, onde ouvir e como marcar uma apresentação. Um kit de divulgação bem organizado facilita essa decisão.",
      "Reúna uma biografia curta, uma versão mais completa da história do grupo, fotos autorizadas em boa resolução, links diretos para músicas e vídeos, cidade de origem e um contato que seja acompanhado. Se houver material ao vivo, inclua um vídeo que represente bem a apresentação real — não apenas um teaser com cortes rápidos.",
      "Mantenha os arquivos em uma pasta compartilhável e confira as permissões antes de enviar. Evite anexar muitos arquivos pesados na primeira mensagem."
    ]
  },
  {
    title: "Faça uma apresentação que diga algo concreto",
    paragraphs: [
      "“Somos uma banda de rock com influências variadas” não ajuda muito quem ainda não conhece o projeto. Prefira informações verificáveis: cidade, ano de formação se confirmado, integrantes, estilos, lançamentos e o que diferencia a proposta musical.",
      "Não invente números de público, conquistas ou citações de imprensa para parecer maior. Uma apresentação honesta e específica transmite mais confiança do que uma lista de superlativos sem comprovação."
    ]
  },
  {
    title: "Escolha o canal de divulgação conforme o objetivo",
    paragraphs: [
      "Para conquistar ouvintes, publique trechos que levem à faixa completa e deixe o link de escuta fácil de encontrar. Para buscar shows, destaque o vídeo ao vivo, a formação disponível e a região em que a banda pode tocar. Para apresentar um lançamento à imprensa, prepare uma mensagem curta com a data, o contexto da música e links funcionais.",
      "Evite enviar exatamente a mesma mensagem para todo mundo. Uma abordagem personalizada — explicando por que aquela casa, página ou evento combina com o grupo — demonstra que a proposta não foi disparada indiscriminadamente."
    ]
  },
  {
    title: "Planeje o lançamento em etapas",
    paragraphs: [
      "Em vez de divulgar apenas no dia em que a música sai, organize pequenas ações antes e depois: apresentar a capa, contar uma curiosidade real sobre a gravação, publicar um trecho, divulgar o link no lançamento e compartilhar a reação do público depois.",
      "Cada publicação deve ter uma função clara. Se o objetivo é levar alguém à música, coloque o link direto. Se é anunciar um show, informe data, cidade, local, horário e venda de ingressos assim que esses dados estiverem confirmados."
    ]
  },
  {
    title: "Construa relações com a cena independente",
    paragraphs: [
      "Conheça bandas da mesma região, acompanhe casas de shows, participe de eventos e procure oportunidades de dividir palco com projetos compatíveis. Apoiar o trabalho de outros artistas e manter contato profissional pode abrir portas para parcerias duradouras.",
      "Ao enviar uma pauta para um portal ou uma página especializada, inclua informações verificadas e imagens que você tem autorização para divulgar. Respeite o tempo de quem recebe a mensagem e evite cobrar uma publicação imediata."
    ]
  },
  {
    title: "Acompanhe o que funciona e mantenha tudo atualizado",
    paragraphs: [
      "Anote de onde vieram os contatos para shows, quais publicações levaram pessoas a ouvir a música e quais materiais foram mais solicitados. Mesmo uma planilha simples ajuda a entender onde vale concentrar esforço.",
      "Revise periodicamente a biografia, os links, as fotos e o contato. Um link quebrado ou um endereço antigo pode fazer uma oportunidade se perder. Se a banda mudou de formação, lançou um trabalho ou tem uma nova data, atualize o material antes de enviá-lo novamente."
    ]
  }
];

function GuiaDivulgacaoBandas() {
  return (
    <main className="section" style={{ maxWidth: "900px", margin: "0 auto", padding: "36px 20px 64px" }}>
      <nav aria-label="Navegação estrutural" style={{ color: "#999", fontSize: "13px", marginBottom: "22px" }}>
        <a href="/" style={{ color: "#e9b61e", textDecoration: "none" }}>Início</a>
        {" / "}
        <span>Guias para bandas</span>
      </nav>

      <header style={{ marginBottom: "30px" }}>
        <p style={{ color: "#e9b61e", fontSize: "12px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" }}>
          Guia para artistas independentes
        </p>
        <h1 style={{ color: "#fff", fontSize: "clamp(30px, 5vw, 44px)", lineHeight: 1.15, margin: "10px 0 16px" }}>
          Como divulgar sua banda independente: um guia prático para organizar o próximo passo
        </h1>
        <p style={{ color: "#c4c4cc", fontSize: "18px", lineHeight: 1.7, margin: 0 }}>
          Um roteiro para apresentar sua música, preparar materiais profissionais, buscar oportunidades de shows e aprender com os resultados sem depender de um grande orçamento.
        </p>
      </header>

      <div style={{ borderLeft: "3px solid #e9b61e", padding: "4px 0 4px 18px", margin: "28px 0", color: "#bbb", lineHeight: 1.8 }}>
        <strong style={{ color: "#fff" }}>Antes de começar:</strong> reúna links, fotos e informações verdadeiras sobre o grupo. O objetivo não é parecer maior do que você é, mas facilitar para que as pessoas conheçam e avaliem seu trabalho.
      </div>

      <div style={{ color: "#ddd", fontSize: "16px", lineHeight: 1.85 }}>
        <p>
          Ter músicas disponíveis é só uma parte do trabalho de uma banda independente. Para chegar a novos ouvintes, produtores, casas de shows e veículos especializados, também é importante apresentar o projeto com clareza e manter os canais de contato funcionando. Este guia organiza ações que podem ser feitas aos poucos, com ferramentas simples e sem prometer resultados automáticos.
        </p>

        {sections.map((section, index) => (
          <section key={section.title} style={{ marginTop: "32px" }}>
            <h2 style={{ color: "#fff", fontSize: "23px", lineHeight: 1.35, marginBottom: "12px" }}>
              {index + 1}. {section.title}
            </h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}

        <section style={{ marginTop: "38px", padding: "22px", border: "1px solid #33333d", borderRadius: "10px", background: "#15151b" }}>
          <h2 style={{ color: "#e9b61e", fontSize: "22px", marginTop: 0 }}>Checklist rápido antes de enviar sua próxima pauta</h2>
          <ul style={{ paddingLeft: "22px" }}>
            <li>Biografia revisada, sem informações desatualizadas.</li>
            <li>Links de música e vídeo testados em celular e computador.</li>
            <li>Fotos autorizadas, com boa resolução e crédito quando necessário.</li>
            <li>Objetivo da mensagem claro: imprensa, show, parceria ou lançamento.</li>
            <li>Contato correto e alguém responsável por responder.</li>
            <li>Informações de datas, locais e lançamentos confirmadas antes da divulgação.</li>
          </ul>
        </section>

        <p style={{ marginTop: "30px" }}>
          Divulgar uma banda é um processo contínuo de apresentação, relacionamento e aprendizado. Não existe fórmula que garanta público ou contratos, mas materiais organizados, comunicação honesta e participação na cena tornam mais fácil para as pessoas certas descobrirem o que o grupo faz.
        </p>
      </div>

      <footer style={{ marginTop: "36px", paddingTop: "22px", borderTop: "1px solid #303039", color: "#aaa", lineHeight: 1.7 }}>
        <p style={{ marginTop: 0 }}>
          Sua banda tem um lançamento, uma história ou uma novidade confirmada para compartilhar?
        </p>
        <p>
          <a href="/cadastrar-banda" style={{ color: "#e9b61e", fontWeight: 700, textDecoration: "none" }}>Apresente sua banda ao Comunidade do Rock</a>
          {" "}ou <a href="/contato" style={{ color: "#e9b61e", fontWeight: 700, textDecoration: "none" }}>fale com a equipe</a>.
        </p>
      </footer>
    </main>
  );
}

export default GuiaDivulgacaoBandas;
