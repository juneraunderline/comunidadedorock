import React, { useEffect } from "react";

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
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Aprenda a montar um release musical, organizar links e fotos, apresentar um lançamento à imprensa e divulgar sua banda independente com clareza.";
    let descriptionTag = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionTag?.getAttribute("content") || null;
    const createdDescriptionTag = !descriptionTag;
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.setAttribute("name", "description");
      document.head.appendChild(descriptionTag);
    }
    document.title = "Como divulgar sua banda independente | Comunidade do Rock";
    descriptionTag.setAttribute("content", description);
    return () => {
      document.title = previousTitle;
      if (createdDescriptionTag) descriptionTag.remove();
      else if (previousDescription !== null) descriptionTag.setAttribute("content", previousDescription);
    };
  }, []);

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
        <p style={{ color: "#999", fontSize: "13px", marginBottom: "22px" }}>Guia editorial da Comunidade do Rock · Atualizado em 15 de outubro de 2026</p>
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


        <section style={{ marginTop: "38px" }}>
          <h2 style={{ color: "#fff", fontSize: "23px", lineHeight: 1.35, marginBottom: "12px" }}>Como montar um release musical que a imprensa consiga usar</h2>
          <p>Um release é um texto curto que apresenta uma novidade jornalística: o lançamento de um single, álbum ou videoclipe, uma turnê, uma mudança importante na formação ou outro acontecimento confirmado. Ele não substitui a música nem obriga um veículo a publicar a pauta. Sua função é entregar os dados essenciais para que a pessoa responsável avalie rapidamente se o assunto combina com o público dela.</p>
          <p>Comece pelo fato mais importante. Em vez de um título genérico como “Banda lança música nova”, tente uma formulação específica, sem exageros: “Banda de [cidade] apresenta o single [nome], inspirado em [contexto real]”. Não use “revolucionário”, “o maior do Brasil” ou números de audiência se não houver evidência verificável para sustentar essas afirmações.</p>
          <p>No primeiro parágrafo, responda ao básico: quem está lançando, o que foi lançado, quando chega ao público e onde pode ser ouvido. Depois explique o contexto da obra, cite participantes confirmados da gravação e acrescente uma declaração real de alguém da banda, caso exista. Não invente aspas nem atribua frases a artistas sem autorização.</p>
        </section>

        <section style={{ marginTop: "32px", padding: "22px", border: "1px solid #33333d", borderRadius: "10px", background: "#15151b" }}>
          <h2 style={{ color: "#e9b61e", fontSize: "22px", marginTop: 0 }}>Modelo de release para adaptar</h2>
          <p style={{ color: "#bbb" }}>Substitua os campos entre colchetes por informações confirmadas. Apague o que não se aplicar e não envie o texto com campos em aberto.</p>
          <div style={{ padding: "16px", background: "#0c0c10", borderRadius: "8px", border: "1px solid #303039", whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "#eee", fontSize: "14px" }}>
            {"ASSUNTO: [Nome da banda] lança [single/álbum/videoclipe] em [data]\n\n[Nome da banda], projeto de [cidade/estado], apresenta [nome do lançamento] em [data]. O trabalho pode ser ouvido/visto em [link direto].\n\n[Explique em duas ou três frases o contexto da música, o tema da letra ou uma decisão real da gravação. Inclua apenas informações confirmadas.]\n\nO lançamento contou com [integrantes, produtores ou convidados confirmados, se relevante]. “ [Declaração real e autorizada de um integrante] ”, comenta [nome e função].\n\nOuça/assista: [link direto]\nFotos e material de divulgação: [link da pasta com acesso liberado]\nInstagram/site: [link]\nContato para imprensa: [nome ou função e e-mail]\n\nSobre a banda: [biografia objetiva de duas a quatro frases, com cidade, estilo, formação ou lançamentos relevantes]."}
          </div>
          <p style={{ marginBottom: 0 }}>Esse modelo é um ponto de partida, não uma fórmula obrigatória. O texto final deve refletir a história real da banda e a novidade específica que está sendo apresentada.</p>
        </section>

        <section style={{ marginTop: "32px" }}>
          <h2 style={{ color: "#fff", fontSize: "23px", lineHeight: 1.35, marginBottom: "12px" }}>Como enviar a pauta sem atrapalhar quem recebe</h2>
          <p>Use um assunto de e-mail que identifique a banda e a novidade. Escreva uma mensagem breve, explique por que a pauta pode interessar àquele veículo e inclua o link para ouvir a música logo no começo. Antes de enviar, abra todos os links em uma janela anônima para confirmar que não exigem login nem autorização particular.</p>
          <p>Prefira uma pasta organizada com fotos em boa resolução, créditos, capa e biografia. Informe quem fotografou e confirme que a banda tem autorização para disponibilizar o material. Para arquivos de áudio e vídeo, links de plataformas conhecidas costumam ser mais práticos do que anexos pesados.</p>
          <p>Não dispare mensagens em massa com destinatários visíveis. Personalize o contato e respeite as regras de cada veículo. Se não houver resposta, um único acompanhamento educado depois de alguns dias úteis é suficiente; não cobre publicação nem trate o silêncio como promessa de cobertura.</p>
        </section>

        <section style={{ marginTop: "32px" }}>
          <h2 style={{ color: "#fff", fontSize: "23px", lineHeight: 1.35, marginBottom: "12px" }}>Organize o lançamento em um calendário simples</h2>
          <ul style={{ paddingLeft: "22px" }}>
            <li><strong>Antes do lançamento:</strong> confirme a data nas plataformas, prepare a capa, revise os créditos e deixe os links prontos.</li>
            <li><strong>No dia:</strong> publique o link direto, compartilhe um trecho autorizado e envie o release aos contatos relevantes.</li>
            <li><strong>Depois:</strong> compartilhe material de bastidores, apresentações confirmadas ou informações novas — não repita a mesma chamada sem acrescentar nada.</li>
            <li><strong>Ao longo do tempo:</strong> atualize a biografia, registre os resultados e mantenha uma lista de contatos que aceitaram receber futuras pautas.</li>
          </ul>
          <p>Uma planilha pode registrar o veículo, o contato público, a data de envio, a pauta apresentada e a resposta recebida. Use os dados apenas para organizar o trabalho e respeite pedidos para não receber novos contatos.</p>
        </section>

        <section style={{ marginTop: "32px" }}>
          <h2 style={{ color: "#fff", fontSize: "23px", lineHeight: 1.35, marginBottom: "12px" }}>Dúvidas frequentes</h2>
          <h3 style={{ color: "#e9b61e", fontSize: "18px" }}>Preciso pagar para divulgar uma música?</h3>
          <p>Não necessariamente. É possível divulgar por canais próprios, enviar pautas relevantes e construir relações com a cena sem comprar publicação. Se um serviço oferecer publicidade paga, confira o que está sendo contratado e não confunda anúncio comercial com cobertura editorial independente.</p>
          <h3 style={{ color: "#e9b61e", fontSize: "18px" }}>Um release garante que a imprensa publique a notícia?</h3>
          <p>Não. Cada veículo decide o que publicar de acordo com sua linha editorial, espaço e interesse do público. Um release claro facilita a avaliação, mas não garante cobertura, público, contratos ou resultados comerciais.</p>
          <h3 style={{ color: "#e9b61e", fontSize: "18px" }}>Posso enviar a mesma pauta para todos os sites?</h3>
          <p>Os fatos centrais podem ser os mesmos, mas a mensagem de apresentação deve ser adaptada ao veículo. Verifique se ele aceita releases, quais formatos prefere e se há um contato editorial público para esse tipo de assunto.</p>
        </section>

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
