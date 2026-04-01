import { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function Admin() {
  const [logged, setLogged] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [posts, setPosts] = useState([]);
  const [bands, setBands] = useState([]);
  const [pendingBands, setPendingBands] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [newPost, setNewPost] = useState({ title: "", content: "", image: "", link: "" });
  const [newBand, setNewBand] = useState({ name: "", genre: "", city: "", state: "", year: "", members: "", biography: "", contact: "", image: "", instagram: "", facebook: "", youtube: "", spotify: "", bandcamp: "", site: "" });
  const [activeTab, setActiveTab] = useState("rss");
  const [editingPost, setEditingPost] = useState(null);
  const [editingBand, setEditingBand] = useState(null);
  const [editingInterview, setEditingInterview] = useState(null);
  const [newInterview, setNewInterview] = useState({ title: "", artist: "", content: "", image: "", date: "" });
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ title: "", artist: "", date: "", time: "", location: "", city: "", state: "", image: "", ticket_link: "", description: "" });
  const [editingEvent, setEditingEvent] = useState(null);

  const [rssFeeds, setRssFeeds] = useState([]);
  const [feedName, setFeedName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [feedLogo, setFeedLogo] = useState("");
  const [loadingFeeds, setLoadingFeeds] = useState([]);
  const [editingLogoId, setEditingLogoId] = useState(null);
  const [editingLogoUrl, setEditingLogoUrl] = useState("");
  const [editingFeedId, setEditingFeedId] = useState(null);
  const [editingFeedName, setEditingFeedName] = useState("");
  const [editingFeedUrl, setEditingFeedUrl] = useState("");

  const editingContentRef = useRef(null);
  const newContentRef = useRef(null);

  // Sincronizar conteúdo do editor quando editingPost muda
  useEffect(() => {
    if (editingPost && editingContentRef.current) {
      editingContentRef.current.innerHTML = editingPost.content;
    }
  }, [editingPost?.id]);

  // Sincronizar conteúdo do novo post
  useEffect(() => {
    if (newContentRef.current) {
      newContentRef.current.innerHTML = newPost.content;
    }
  }, []);

  useEffect(() => {
    axios.get("http://localhost:3000/api/rss-feeds")
      .then(res => setRssFeeds(res.data))
      .catch(() => setRssFeeds([]));
  }, []);

  const login = () => {
    axios.post("http://localhost:3000/api/login", { user, pass })
      .then(() => {
        setLogged(true);
        fetchData();
      })
      .catch(() => alert("Login errado"));
  };

  const fetchData = () => {
    axios.get("http://localhost:3000/api/posts").then(res => setPosts(res.data));
    axios.get("http://localhost:3000/api/bands").then(res => setBands(res.data));
    axios.get("http://localhost:3000/api/pending-bands").then(res => setPendingBands(res.data));
    axios.get("http://localhost:3000/api/interviews").then(res => setInterviews(res.data));
    axios.get("http://localhost:3000/api/events").then(res => setEvents(res.data));
    // Buscar feeds RSS do backend
    axios.get("http://localhost:3000/api/rss-feeds").then(res => setRssFeeds(res.data));
  };

  // Função para comprimir imagem
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Redimensionar se muito grande
          if (width > 800) {
            height = (height * 800) / width;
            width = 800;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Comprimir para JPEG com qualidade 0.7
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedBase64);
        };
      };
    });
  };

  // Função para lidar com paste de imagens
  const handleContentPaste = async (e, isEditing = false) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let item of items) {
      if (item.type.includes("image")) {
        e.preventDefault();
        const file = item.getAsFile();
        
        try {
          const compressedBase64 = await compressImage(file);
          const imgHtml = `<img src="${compressedBase64}" style="max-width: 80%; margin: 20px auto; display: block; border-radius: 8px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);" />`;
          
          // Inserir na posição do cursor do contenteditable
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = imgHtml;
            const img = tempDiv.firstChild;
            range.insertNode(img);
            range.setStartAfter(img);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Atualizar o state com o HTML do editor
            const editor = e.currentTarget;
            const newContent = editor.innerHTML;
            
            if (isEditing) {
              setEditingPost({
                ...editingPost,
                content: newContent
              });
            } else {
              setNewPost({
                ...newPost,
                content: newContent
              });
            }
          }
        } catch (err) {
          alert("Erro ao processar imagem: " + err.message);
        }
      }
    }
  };

  const handleContentInput = (e, isEditing = false) => {
    const newContent = e.currentTarget.innerHTML;
    
    if (isEditing) {
      setEditingPost({
        ...editingPost,
        content: newContent
      });
    } else {
      setNewPost({
        ...newPost,
        content: newContent
      });
    }
  };

  const createPost = () => {
    // Ler conteúdo direto do ref para garantir que imagens coladas sejam incluídas
    const finalContent = newContentRef.current ? newContentRef.current.innerHTML : newPost.content;
    
    if (!newPost.title.trim() || !finalContent.trim()) {
      alert("Preencha título e conteúdo");
      return;
    }

    axios.post("http://localhost:3000/api/posts", { ...newPost, content: finalContent })
      .then(() => {
        setNewPost({ title: "", content: "", image: "", link: "" });
        if (newContentRef.current) {
          newContentRef.current.innerHTML = "";
        }
        fetchData();
        alert("Notícia publicada com sucesso!");
      })
      .catch((err) => alert("Erro ao publicar: " + (err.response?.data?.error || err.message)));
  };

  const deletePost = (id) => {
    axios.delete(`http://localhost:3000/api/posts/${id}`)
      .then(() => {
        alert("Notícia deletada com sucesso!");
        fetchData();
      })
      .catch((err) => {
        console.error("Erro ao deletar:", err);
        alert("Erro ao deletar notícia: " + (err.response?.data?.error || err.message));
      });
  };

  const startEditPost = (post) => {
    setEditingPost({ ...post });
  };

  const saveEditPost = () => {
    // Ler conteúdo direto do ref para garantir que imagens coladas sejam incluídas
    const finalContent = editingContentRef.current ? editingContentRef.current.innerHTML : editingPost.content;
    
    if (!editingPost.title.trim() || !finalContent.trim()) {
      alert("Preencha título e conteúdo");
      return;
    }

    axios.put(`http://localhost:3000/api/posts/${editingPost.id}`, {
      title: editingPost.title,
      content: finalContent,
      image: editingPost.image,
      link: editingPost.link
    })
      .then(() => {
        setEditingPost(null);
        fetchData();
        alert("Notícia atualizada com sucesso!");
      })
      .catch((err) => alert("Erro ao atualizar notícia: " + (err.response?.data?.error || err.message)));
  };

  const cancelEditPost = () => {
    setEditingPost(null);
  };

  const startEditBand = (band) => {
    setEditingBand({ ...band });
  };

  const saveEditBand = () => {
    if (!editingBand.name.trim()) {
      alert("Preencha o nome da banda");
      return;
    }

    axios.put(`http://localhost:3000/api/bands/${editingBand.id}`, {
      name: editingBand.name,
      genre: editingBand.genre,
      city: editingBand.city,
      state: editingBand.state,
      year: editingBand.year,
      members: editingBand.members,
      biography: editingBand.biography,
      contact: editingBand.contact,
      image: editingBand.image,
      instagram: editingBand.instagram,
      facebook: editingBand.facebook,
      youtube: editingBand.youtube,
      spotify: editingBand.spotify,
      bandcamp: editingBand.bandcamp,
      site: editingBand.site
    })
      .then(() => {
        setEditingBand(null);
        fetchData();
        alert("Banda atualizada com sucesso!");
      })
      .catch(() => alert("Erro ao atualizar banda"));
  };

  const cancelEditBand = () => {
    setEditingBand(null);
  };

  const deleteBand = (id) => {
    axios.delete(`http://localhost:3000/api/bands/${id}`)
      .then(() => fetchData());
  };

  const createBand = () => {
    if (!newBand.name.trim()) {
      alert("Preencha o nome da banda");
      return;
    }

    axios.post("http://localhost:3000/api/bands", newBand)
      .then(() => {
        setNewBand({ name: "", genre: "", city: "", state: "", year: "", members: "", biography: "", contact: "", image: "", instagram: "", facebook: "", youtube: "", spotify: "", bandcamp: "", site: "" });
        fetchData();
        alert("Banda adicionada com sucesso!");
      })
      .catch((err) => alert("Erro ao adicionar banda: " + (err.response?.data?.error || err.message)));
  };

  const cancelCreateBand = () => {
    setNewBand({ name: "", genre: "", city: "", state: "", year: "", members: "", biography: "", contact: "", image: "", instagram: "", facebook: "", youtube: "", spotify: "", bandcamp: "", site: "" });
  };

  const approveBand = (id) => {
    axios.post(`http://localhost:3000/api/approve-band/${id}`)
      .then(() => fetchData());
  };

  const createInterview = () => {
    if (!newInterview.title.trim() || !newInterview.artist.trim()) {
      alert("Preencha título e artista");
      return;
    }

    axios.post("http://localhost:3000/api/interviews", newInterview)
      .then(() => {
        setNewInterview({ title: "", artist: "", content: "", image: "", date: "" });
        fetchData();
        alert("Entrevista adicionada com sucesso!");
      })
      .catch((err) => alert("Erro ao adicionar entrevista: " + (err.response?.data?.error || err.message)));
  };

  const startEditInterview = (interview) => {
    setEditingInterview({ ...interview });
  };

  const saveEditInterview = () => {
    if (!editingInterview.title.trim() || !editingInterview.artist.trim()) {
      alert("Preencha título e artista");
      return;
    }

    axios.put(`http://localhost:3000/api/interviews/${editingInterview.id}`, {
      title: editingInterview.title,
      artist: editingInterview.artist,
      content: editingInterview.content,
      image: editingInterview.image,
      date: editingInterview.date
    })
      .then(() => {
        setEditingInterview(null);
        fetchData();
        alert("Entrevista atualizada com sucesso!");
      })
      .catch((err) => alert("Erro ao atualizar entrevista: " + (err.response?.data?.error || err.message)));
  };

  const cancelEditInterview = () => {
    setEditingInterview(null);
  };

  const deleteInterview = (id) => {
    axios.delete(`http://localhost:3000/api/interviews/${id}`)
      .then(() => {
        alert("Entrevista deletada com sucesso!");
        fetchData();
      })
      .catch((err) => alert("Erro ao deletar entrevista: " + (err.response?.data?.error || err.message)));
  };

  // ====== EVENTOS ======
  const createEvent = () => {
    if (!newEvent.title.trim() || !newEvent.date) {
      alert("Preencha pelo menos o título e a data");
      return;
    }

    axios.post("http://localhost:3000/api/events", newEvent)
      .then(() => {
        setNewEvent({ title: "", artist: "", date: "", time: "", location: "", city: "", state: "", image: "", ticket_link: "", description: "" });
        fetchData();
        alert("Evento adicionado com sucesso!");
      })
      .catch((err) => alert("Erro ao adicionar evento: " + (err.response?.data?.error || err.message)));
  };

  const startEditEvent = (event) => {
    setEditingEvent({ ...event });
  };

  const saveEditEvent = () => {
    if (!editingEvent.title.trim() || !editingEvent.date) {
      alert("Preencha pelo menos o título e a data");
      return;
    }

    axios.put(`http://localhost:3000/api/events/${editingEvent.id}`, {
      title: editingEvent.title,
      artist: editingEvent.artist,
      date: editingEvent.date,
      time: editingEvent.time,
      location: editingEvent.location,
      city: editingEvent.city,
      state: editingEvent.state,
      image: editingEvent.image,
      ticket_link: editingEvent.ticket_link,
      description: editingEvent.description
    })
      .then(() => {
        setEditingEvent(null);
        fetchData();
        alert("Evento atualizado com sucesso!");
      })
      .catch((err) => alert("Erro ao atualizar evento: " + (err.response?.data?.error || err.message)));
  };

  const cancelEditEvent = () => {
    setEditingEvent(null);
  };

  const deleteEvent = (id) => {
    axios.delete(`http://localhost:3000/api/events/${id}`)
      .then(() => {
        alert("Evento deletado com sucesso!");
        fetchData();
      })
      .catch((err) => alert("Erro ao deletar evento: " + (err.response?.data?.error || err.message)));
  };

  const addRssFeed = async () => {
    if (!feedName.trim() || !feedUrl.trim()) {
      alert("Preencha nome e URL do feed");
      return;
    }

    try {
      const res = await axios.post("http://localhost:3000/api/rss-feeds", { 
        name: feedName.trim(), 
        url: feedUrl.trim(),
        logo: feedLogo.trim() || null
      });
      
      if (res.data.success) {
        setRssFeeds(res.data.feeds);
        setFeedName("");
        setFeedUrl("");
        setFeedLogo("");
        alert("Feed adicionado com sucesso! Será atualizado automaticamente a cada 10 segundos.");
      }
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao adicionar feed");
    }
  };

  const removeRssFeed = async (index) => {
    try {
      const res = await axios.delete(`http://localhost:3000/api/rss-feeds/${index}`);
      
      if (res.data.success) {
        setRssFeeds(res.data.feeds);
        alert("Feed removido com sucesso!");
      }
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao remover feed");
    }
  };

  const updateFeedLogo = async (index) => {
    if (!editingLogoUrl.trim()) {
      alert("Preencha a URL da logo");
      return;
    }

    try {
      const res = await axios.put(`http://localhost:3000/api/rss-feeds/${index}/logo`, {
        logo: editingLogoUrl.trim()
      });
      
      if (res.data.success) {
        setRssFeeds(res.data.feeds);
        setEditingLogoId(null);
        setEditingLogoUrl("");
        alert("Logo atualizada com sucesso!");
      }
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao atualizar logo");
    }
  };

  const startEditFeed = (index) => {
    const feed = rssFeeds[index];
    setEditingFeedId(index);
    setEditingFeedName(feed.name);
    setEditingFeedUrl(feed.url);
  };

  const saveEditFeed = async () => {
    if (!editingFeedName.trim() || !editingFeedUrl.trim()) {
      alert("Preencha nome e URL do feed");
      return;
    }

    try {
      const res = await axios.put(`http://localhost:3000/api/rss-feeds/${editingFeedId}`, {
        name: editingFeedName.trim(),
        url: editingFeedUrl.trim()
      });
      
      if (res.data.success) {
        setRssFeeds(res.data.feeds);
        setEditingFeedId(null);
        setEditingFeedName("");
        setEditingFeedUrl("");
        alert("Feed atualizado com sucesso!");
      }
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao atualizar feed");
    }
  };

  const cancelEditFeed = () => {
    setEditingFeedId(null);
    setEditingFeedName("");
    setEditingFeedUrl("");
  };

  const importRssFeeds = async () => {
    if (rssFeeds.length === 0) {
      alert("Nenhum feed adicionado para importar.");
      return;
    }

    try {
      const res = await axios.post("http://localhost:3000/api/import-rss", { feeds: rssFeeds });

      if (res.data && res.data.success) {
        alert(`Importado(s) ${res.data.imported} notícia(s)`);
        fetchData();
      } else {
        alert("Não foi possível importar feeds");
      }
    } catch (err) {
      alert("Erro ao importar feeds: " + (err?.response?.data?.error || err.message));
    }
  };

  const reimportRssFeeds = async () => {
    if (rssFeeds.length === 0) {
      alert("Nenhum feed adicionado para reimportar.");
      return;
    }

    try {
      const res = await axios.post("http://localhost:3000/api/reimport-rss", { feeds: rssFeeds });

      if (res.data && res.data.success) {
        alert(`Imagens atualizadas em ${res.data.updated} notícia(s) e ${res.data.created} novas criadas!`);
        fetchData();
      } else {
        alert("Não foi possível reimportar feeds");
      }
    } catch (err) {
      alert("Erro ao reimportar feeds: " + (err?.response?.data?.error || err.message));
    }
  };

  const importSingleFeed = async (index) => {
    const feed = rssFeeds[index];
    setLoadingFeeds([...loadingFeeds, index]);

    try {
      const res = await axios.post("http://localhost:3000/api/import-rss-single", { feed });

      if (res.data && res.data.success) {
        alert(`Importado(s) ${res.data.imported} notícia(s) de ${feed.name}`);
        fetchData();
      } else {
        alert(`Não foi possível importar do feed ${feed.name}`);
      }
    } catch (err) {
      alert(`Erro ao importar feed ${feed.name}: ` + (err?.response?.data?.error || err.message));
    } finally {
      setLoadingFeeds(loadingFeeds.filter(i => i !== index));
    }
  };

  const fixMissingImages = async () => {
    if (!confirm("Isso vai tentar encontrar e adicionar imagens às notícias que não têm. Continuar?")) {
      return;
    }

    try {
      const res = await axios.post("http://localhost:3000/api/fix-missing-images");

      if (res.data && res.data.success) {
        alert(`✅ ${res.data.fixed} de ${res.data.total} imagens foram corrigidas!\n\n${res.data.message}`);
        fetchData();
      } else {
        alert("Erro ao corrigir imagens");
      }
    } catch (err) {
      alert("Erro ao corrigir imagens: " + (err?.response?.data?.error || err.message));
    }
  };

  const testRssFeedImages = async (feedUrl) => {
    try {
      const res = await axios.post("http://localhost:3000/api/test-rss-images", { feedUrl });

      if (res.data && res.data.success) {
        alert(`📊 Teste de ${res.data.feedUrl}\n\n` +
          `Total de itens: ${res.data.totalItems}\n` +
          `Com imagens: ${res.data.itemsWithImages}\n` +
          `Sem imagens: ${res.data.itemsWithoutImages}`);
      } else {
        alert("Erro ao testar feed");
      }
    } catch (err) {
      alert("Erro ao testar feed: " + (err?.response?.data?.error || err.message));
    }
  };

  if (!logged) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <h1>PAINEL ADMIN</h1>
          <p>Acesso restrito — faça login para continuar</p>

          <div className="admin-login-field">
            <label>Email</label>
            <input
              type="text"
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="admin"
            />
          </div>

          <div className="admin-login-field">
            <label>Senha</label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="1234"
            />
          </div>

          <button className="btn btn-primary" onClick={login}>ENTRAR</button>
        </div>
      </div>
    );
  }

  const logout = () => {
    setLogged(false);
    setUser("");
    setPass("");
    setPosts([]);
    setBands([]);
    setPendingBands([]);
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div>
          <h1>PAINEL <span>ADMIN</span></h1>
          <p>Gestão de notícias, bandas, entrevistas e eventos</p>
        </div>
        <button className="btn btn-outline" onClick={logout}>Sair</button>
      </header>

      <div className="admin-tabs">
        <button className={activeTab === "rss" ? "active" : ""} onClick={() => setActiveTab("rss")}>RSS</button>
        <button className={activeTab === "noticias" ? "active" : ""} onClick={() => setActiveTab("noticias")}>NOTÍCIAS</button>
        <button className={activeTab === "bandas" ? "active" : ""} onClick={() => setActiveTab("bandas")}>BANDAS</button>
        <button className={activeTab === "entrevistas" ? "active" : ""} onClick={() => setActiveTab("entrevistas")}>ENTREVISTAS</button>
        <button className={activeTab === "eventos" ? "active" : ""} onClick={() => setActiveTab("eventos")}>EVENTOS</button>
      </div>

      {activeTab === "rss" && (
      <section className="admin-card">
        <h2>FEEDS RSS</h2>
        <div className="rss-actions">
          <input
            type="text"
            placeholder="Nome do feed"
            value={feedName}
            onChange={(e) => setFeedName(e.target.value)}
          />
          <input
            type="text"
            placeholder="URL do feed RSS"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
          />
          <input
            type="text"
            placeholder="URL da logo (opcional)"
            value={feedLogo}
            onChange={(e) => setFeedLogo(e.target.value)}
          />
          <button className="btn btn-primary" onClick={addRssFeed}>Adicionar</button>
        </div>

        {rssFeeds.length === 0 ? (
          <p style={{ color: "#afafba" }}>Nenhum feed adicionado</p>
        ) : (
          rssFeeds.map((feed, index) => (
            <div key={`${feed.url}-${index}`} className="rss-row" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "start", padding: "12px", backgroundColor: "#1a1a1a", borderRadius: "8px", marginBottom: "12px", borderLeft: "3px solid #e91e63" }}>
              {editingFeedId === index ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#aaa", marginBottom: "4px" }}>Nome do Feed</label>
                    <input
                      type="text"
                      value={editingFeedName}
                      onChange={(e) => setEditingFeedName(e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #5a5a6e", backgroundColor: "#252530", color: "#fff", width: "100%", fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#aaa", marginBottom: "4px" }}>URL do Feed</label>
                    <input
                      type="text"
                      value={editingFeedUrl}
                      onChange={(e) => setEditingFeedUrl(e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #5a5a6e", backgroundColor: "#252530", color: "#fff", width: "100%", fontSize: "12px" }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "start", gap: "12px", minWidth: 0 }}>
                  {feed.logo && (
                    <img 
                      src={feed.logo} 
                      alt={feed.name} 
                      style={{ width: "32px", height: "32px", borderRadius: "4px", objectFit: "contain", flexShrink: 0, marginTop: "2px" }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: "block", marginBottom: "4px" }}>{feed.name}</strong>
                    <p style={{ margin: "4px 0", fontSize: "12px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={feed.url}>
                      {feed.url}
                    </p>
                    {feed.logo && (
                      <p style={{ margin: "4px 0", fontSize: "11px", color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={feed.logo}>
                        Logo: {feed.logo}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "nowrap", justifyContent: "flex-end" }}>
                {editingFeedId === index ? (
                  <>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => saveEditFeed()}
                      style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                      title="Salvar"
                    >
                      💾
                    </button>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => cancelEditFeed()}
                      style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                      title="Cancelar"
                    >
                      ✕
                    </button>
                  </>
                ) : editingLogoId === index ? (
                  <>
                    <input
                      type="text"
                      placeholder="URL da logo"
                      value={editingLogoUrl}
                      onChange={(e) => setEditingLogoUrl(e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #ddd", minWidth: "150px", maxWidth: "250px", fontSize: "12px" }}
                    />
                    <button 
                      className="btn btn-primary" 
                      onClick={() => updateFeedLogo(index)}
                      style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                      title="Salvar"
                    >
                      💾
                    </button>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => { setEditingLogoId(null); setEditingLogoUrl(""); }}
                      style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                      title="Cancelar"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span className="badge">Ativo</span>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => importSingleFeed(index)}
                      disabled={loadingFeeds.includes(index)}
                      style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                      title="Importar feed"
                    >
                      {loadingFeeds.includes(index) ? "..." : "📰"}
                    </button>
                    <button 
                      className="btn-icon" 
                      onClick={() => testRssFeedImages(feed.url)}
                      title="Testar extração de imagens"
                    >
                      🔍
                    </button>
                    <button 
                      className="btn-icon" 
                      onClick={() => startEditFeed(index)}
                      title="Editar feed"
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn-icon" 
                      onClick={() => { setEditingLogoId(index); setEditingLogoUrl(feed.logo || ""); }}
                      title="Editar logo"
                    >
                      🖼️
                    </button>
                    <button className="btn-icon" onClick={() => removeRssFeed(index)} title="Deletar feed">🗑</button>
                  </>
                )}
              </div>
            </div>
          ))
        )}

        <button className="btn btn-outline" onClick={importRssFeeds}>Importar Notícias dos Feeds</button>
        <button className="btn btn-outline" onClick={fixMissingImages} style={{ marginLeft: "8px" }}>🔧 Corrigir Imagens Faltantes</button>
      </section>
      )}

      {activeTab === "noticias" && (
      <section className="admin-card">
        <h2>GERENCIAR NOTÍCIAS</h2>
        
        {editingPost && (
          <div className="edit-post-form">
            <h3>Editando Notícia</h3>
            <div className="form-group">
              <label>Título</label>
              <input
                type="text"
                value={editingPost.title}
                onChange={(e) => setEditingPost({...editingPost, title: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Conteúdo</label>
              <div
                ref={editingContentRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => handleContentInput(e, true)}
                onPaste={(e) => handleContentPaste(e, true)}
                style={{
                  padding: "10px",
                  border: "1px solid #5a5a6e",
                  borderRadius: "4px",
                  backgroundColor: "#1a1a2e",
                  color: "#fff",
                  minHeight: "150px",
                  fontFamily: "monospace",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word"
                }}
              />
            </div>
            <div className="form-group">
              <label>URL da Imagem</label>
              <input
                type="text"
                value={editingPost.image}
                onChange={(e) => setEditingPost({...editingPost, image: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Link da Notícia (URL Original)</label>
              <input
                type="text"
                value={editingPost.link || ""}
                onChange={(e) => setEditingPost({...editingPost, link: e.target.value})}
                placeholder="https://..."
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={saveEditPost}>Salvar</button>
              <button className="btn btn-outline" onClick={cancelEditPost}>Cancelar</button>
            </div>
          </div>
        )}

        {!editingPost && (
          <div className="edit-post-form">
            <h3>Nova Notícia</h3>
            <div className="form-group">
              <label>Título</label>
              <input
                type="text"
                value={newPost.title}
                onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                placeholder="Digite o título da notícia"
              />
            </div>
            <div className="form-group">
              <label>Conteúdo</label>
              <div
                ref={newContentRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => handleContentInput(e, false)}
                onPaste={(e) => handleContentPaste(e, false)}
                style={{
                  padding: "10px",
                  border: "1px solid #5a5a6e",
                  borderRadius: "4px",
                  backgroundColor: "#1a1a2e",
                  color: "#fff",
                  minHeight: "150px",
                  fontFamily: "monospace",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word"
                }}
              />
            </div>
            <div className="form-group">
              <label>URL da Imagem</label>
              <input
                type="text"
                value={newPost.image}
                onChange={(e) => setNewPost({...newPost, image: e.target.value})}
                placeholder="URL da imagem"
              />
            </div>
            <div className="form-group">
              <label>Link da Notícia (URL Original)</label>
              <input
                type="text"
                value={newPost.link || ""}
                onChange={(e) => setNewPost({...newPost, link: e.target.value})}
                placeholder="https://..."
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={createPost}>Publicar</button>
            </div>
          </div>
        )}

        <div className="posts-list">
          <h3>Lista de Notícias ({posts.length})</h3>
          <div style={{marginBottom: "16px"}}>
            <button className="btn btn-outline" onClick={reimportRssFeeds}>🔄 Reimportar e Atualizar Imagens</button>
          </div>
          {posts.length === 0 && <p>Nenhuma notícia publicada</p>}
          {posts.map(post => (
            <div key={post.id} className="post-item">
              <div className="post-preview">
                {post.image && <img src={post.image} alt={post.title} />}
                <div className="post-info">
                  <h4>{post.title}</h4>
                  <p>{(post.content || "").substring(0, 100)}...</p>
                </div>
              </div>
              <div className="post-actions">
                <button className="btn btn-primary" onClick={() => startEditPost(post)}>✏️ Editar</button>
                <button className="btn btn-outline" onClick={() => {if (confirm("Tem certeza?")) deletePost(post.id)}}>🗑 Deletar</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {activeTab === "bandas" && (
      <section className="admin-card">
        <h2>GERENCIAR BANDAS</h2>

        {editingBand && (
          <div className="edit-post-form">
            <h3>Editando Banda</h3>
            <div className="form-group">
              <label>Nome</label>
              <input
                type="text"
                value={editingBand.name}
                onChange={(e) => setEditingBand({...editingBand, name: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Gênero</label>
              <input
                type="text"
                value={editingBand.genre || ""}
                onChange={(e) => setEditingBand({...editingBand, genre: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Cidade</label>
              <input
                type="text"
                value={editingBand.city || ""}
                onChange={(e) => setEditingBand({...editingBand, city: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <input
                type="text"
                value={editingBand.state || ""}
                onChange={(e) => setEditingBand({...editingBand, state: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Ano de Formação</label>
              <input
                type="text"
                value={editingBand.year || ""}
                onChange={(e) => setEditingBand({...editingBand, year: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Integrantes</label>
              <textarea
                value={editingBand.members || ""}
                onChange={(e) => setEditingBand({...editingBand, members: e.target.value})}
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Biografia</label>
              <textarea
                value={editingBand.biography || ""}
                onChange={(e) => setEditingBand({...editingBand, biography: e.target.value})}
                rows="5"
              />
            </div>
            <div className="form-group">
              <label>URL da Imagem</label>
              <input
                type="text"
                value={editingBand.image || ""}
                onChange={(e) => setEditingBand({...editingBand, image: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Contato</label>
              <input
                type="text"
                value={editingBand.contact || ""}
                onChange={(e) => setEditingBand({...editingBand, contact: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Instagram</label>
              <input
                type="text"
                value={editingBand.instagram || ""}
                onChange={(e) => setEditingBand({...editingBand, instagram: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Facebook</label>
              <input
                type="text"
                value={editingBand.facebook || ""}
                onChange={(e) => setEditingBand({...editingBand, facebook: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>YouTube</label>
              <input
                type="text"
                value={editingBand.youtube || ""}
                onChange={(e) => setEditingBand({...editingBand, youtube: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Spotify</label>
              <input
                type="text"
                value={editingBand.spotify || ""}
                onChange={(e) => setEditingBand({...editingBand, spotify: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Bandcamp</label>
              <input
                type="text"
                value={editingBand.bandcamp || ""}
                onChange={(e) => setEditingBand({...editingBand, bandcamp: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Site</label>
              <input
                type="text"
                value={editingBand.site || ""}
                onChange={(e) => setEditingBand({...editingBand, site: e.target.value})}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={saveEditBand}>Salvar</button>
              <button className="btn btn-outline" onClick={cancelEditBand}>Cancelar</button>
            </div>
          </div>
        )}

        {!editingBand && (
          <>
            <div className="edit-post-form">
              <h3>Nova Banda</h3>
              <div className="form-group">
                <label>Nome</label>
                <input
                  type="text"
                  value={newBand.name}
                  onChange={(e) => setNewBand({...newBand, name: e.target.value})}
                  placeholder="Nome da banda"
                />
              </div>
              <div className="form-group">
                <label>Gênero</label>
                <input
                  type="text"
                  value={newBand.genre}
                  onChange={(e) => setNewBand({...newBand, genre: e.target.value})}
                  placeholder="Gênero musical"
                />
              </div>
              <div className="form-group">
                <label>Cidade</label>
                <input
                  type="text"
                  value={newBand.city}
                  onChange={(e) => setNewBand({...newBand, city: e.target.value})}
                  placeholder="Cidade"
                />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <input
                  type="text"
                  value={newBand.state}
                  onChange={(e) => setNewBand({...newBand, state: e.target.value})}
                  placeholder="Estado (ex: SP)"
                />
              </div>
              <div className="form-group">
                <label>Ano de Formação</label>
                <input
                  type="text"
                  value={newBand.year}
                  onChange={(e) => setNewBand({...newBand, year: e.target.value})}
                  placeholder="Ano"
                />
              </div>
              <div className="form-group">
                <label>Integrantes</label>
                <textarea
                  value={newBand.members}
                  onChange={(e) => setNewBand({...newBand, members: e.target.value})}
                  placeholder="Integrantes da banda"
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Biografia</label>
                <textarea
                  value={newBand.biography}
                  onChange={(e) => setNewBand({...newBand, biography: e.target.value})}
                  placeholder="História da banda"
                  rows="5"
                />
              </div>
              <div className="form-group">
                <label>URL da Imagem</label>
                <input
                  type="text"
                  value={newBand.image}
                  onChange={(e) => setNewBand({...newBand, image: e.target.value})}
                  placeholder="URL da imagem"
                />
              </div>
              <div className="form-group">
                <label>Contato</label>
                <input
                  type="text"
                  value={newBand.contact}
                  onChange={(e) => setNewBand({...newBand, contact: e.target.value})}
                  placeholder="Email ou telefone"
                />
              </div>
              <div className="form-group">
                <label>Instagram</label>
                <input
                  type="text"
                  value={newBand.instagram}
                  onChange={(e) => setNewBand({...newBand, instagram: e.target.value})}
                  placeholder="@usuario"
                />
              </div>
              <div className="form-group">
                <label>Facebook</label>
                <input
                  type="text"
                  value={newBand.facebook}
                  onChange={(e) => setNewBand({...newBand, facebook: e.target.value})}
                  placeholder="URL do Facebook"
                />
              </div>
              <div className="form-group">
                <label>YouTube</label>
                <input
                  type="text"
                  value={newBand.youtube}
                  onChange={(e) => setNewBand({...newBand, youtube: e.target.value})}
                  placeholder="URL do canal"
                />
              </div>
              <div className="form-group">
                <label>Spotify</label>
                <input
                  type="text"
                  value={newBand.spotify}
                  onChange={(e) => setNewBand({...newBand, spotify: e.target.value})}
                  placeholder="Link do Spotify"
                />
              </div>
              <div className="form-group">
                <label>Bandcamp</label>
                <input
                  type="text"
                  value={newBand.bandcamp}
                  onChange={(e) => setNewBand({...newBand, bandcamp: e.target.value})}
                  placeholder="Link do Bandcamp"
                />
              </div>
              <div className="form-group">
                <label>Site</label>
                <input
                  type="text"
                  value={newBand.site}
                  onChange={(e) => setNewBand({...newBand, site: e.target.value})}
                  placeholder="URL do site"
                />
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" onClick={createBand}>Publicar</button>
              </div>
            </div>

            <div className="bands-section">
              <h3>Bandas Aprovadas ({bands.length})</h3>
              {bands.length === 0 && <p>Nenhuma banda aprovada</p>}
              {bands.map(band => (
                <div key={band.id} className="post-item">
                  <div className="post-preview">
                    {band.image && <img src={band.image} alt={band.name} />}
                    <div className="post-info">
                      <h4>{band.name}</h4>
                      <p><strong>{band.genre}</strong> - {band.city}/{band.state}</p>
                      <p>{band.biography ? band.biography.substring(0, 100) : "Sem descrição"}...</p>
                    </div>
                  </div>
                  <div className="post-actions">
                    <button className="btn btn-primary" onClick={() => startEditBand(band)}>✏️ Editar</button>
                    <button className="btn btn-outline" onClick={() => {if (confirm("Tem certeza que deseja deletar esta banda?")) deleteBand(band.id)}}>🗑 Deletar</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="bands-pending-section">
          <h3>Bandas Pendentes</h3>
          <ul>
            {pendingBands.length === 0 && <li>Nenhuma banda pendente</li>}
            {pendingBands.map(b => (
              <li key={b.id}>
                <span>{b.name} - {b.genre} - {b.city}/{b.state}</span>
                <button className="btn btn-primary" onClick={() => approveBand(b.id)}>Aprovar</button>
              </li>
            ))}
          </ul>
        </div>
      </section>
      )}

      {activeTab === "entrevistas" && (
      <section className="admin-card">
        <h2>GERENCIAR ENTREVISTAS</h2>

        {editingInterview && (
          <div className="edit-post-form">
            <h3>Editando Entrevista</h3>
            <div className="form-group">
              <label>Título</label>
              <input
                type="text"
                value={editingInterview.title}
                onChange={(e) => setEditingInterview({...editingInterview, title: e.target.value})}
                placeholder="Título da entrevista"
              />
            </div>
            <div className="form-group">
              <label>Artista/Banda</label>
              <input
                type="text"
                value={editingInterview.artist}
                onChange={(e) => setEditingInterview({...editingInterview, artist: e.target.value})}
                placeholder="Nome do artista ou banda"
              />
            </div>
            <div className="form-group">
              <label>Conteúdo</label>
              <textarea
                value={editingInterview.content || ""}
                onChange={(e) => setEditingInterview({...editingInterview, content: e.target.value})}
                placeholder="Conteúdo da entrevista"
                rows="6"
                style={{
                  padding: "10px",
                  border: "1px solid #5a5a6e",
                  borderRadius: "4px",
                  backgroundColor: "#1a1a2e",
                  color: "#fff",
                  fontFamily: "monospace"
                }}
              />
            </div>
            <div className="form-group">
              <label>URL da Imagem</label>
              <input
                type="text"
                value={editingInterview.image || ""}
                onChange={(e) => setEditingInterview({...editingInterview, image: e.target.value})}
                placeholder="URL da imagem"
              />
            </div>
            <div className="form-group">
              <label>Data</label>
              <input
                type="date"
                value={editingInterview.date || ""}
                onChange={(e) => setEditingInterview({...editingInterview, date: e.target.value})}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={saveEditInterview}>Salvar</button>
              <button className="btn btn-outline" onClick={cancelEditInterview}>Cancelar</button>
            </div>
          </div>
        )}

        {!editingInterview && (
          <div className="edit-post-form">
            <h3>Nova Entrevista</h3>
            <div className="form-group">
              <label>Título</label>
              <input
                type="text"
                value={newInterview.title}
                onChange={(e) => setNewInterview({...newInterview, title: e.target.value})}
                placeholder="Título da entrevista"
              />
            </div>
            <div className="form-group">
              <label>Artista/Banda</label>
              <input
                type="text"
                value={newInterview.artist}
                onChange={(e) => setNewInterview({...newInterview, artist: e.target.value})}
                placeholder="Nome do artista ou banda"
              />
            </div>
            <div className="form-group">
              <label>Conteúdo</label>
              <textarea
                value={newInterview.content}
                onChange={(e) => setNewInterview({...newInterview, content: e.target.value})}
                placeholder="Conteúdo da entrevista"
                rows="6"
                style={{
                  padding: "10px",
                  border: "1px solid #5a5a6e",
                  borderRadius: "4px",
                  backgroundColor: "#1a1a2e",
                  color: "#fff",
                  fontFamily: "monospace"
                }}
              />
            </div>
            <div className="form-group">
              <label>URL da Imagem</label>
              <input
                type="text"
                value={newInterview.image}
                onChange={(e) => setNewInterview({...newInterview, image: e.target.value})}
                placeholder="URL da imagem"
              />
            </div>
            <div className="form-group">
              <label>Data</label>
              <input
                type="date"
                value={newInterview.date}
                onChange={(e) => setNewInterview({...newInterview, date: e.target.value})}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={createInterview}>Publicar</button>
            </div>
          </div>
        )}

        <div className="interviews-list">
          <h3>Lista de Entrevistas ({interviews.length})</h3>
          {interviews.length === 0 && <p>Nenhuma entrevista publicada</p>}
          {interviews.map(interview => (
            <div key={interview.id} className="post-item">
              <div className="post-preview">
                {interview.image && <img src={interview.image} alt={interview.title} />}
                <div className="post-info">
                  <h4>{interview.title}</h4>
                  <p><strong>{interview.artist}</strong></p>
                  <p>{interview.content ? interview.content.substring(0, 100) : "Sem descrição"}...</p>
                  {interview.date && <small>Data: {interview.date}</small>}
                </div>
              </div>
              <div className="post-actions">
                <button className="btn btn-primary" onClick={() => startEditInterview(interview)}>✏️ Editar</button>
                <button className="btn btn-outline" onClick={() => {if (confirm("Tem certeza?")) deleteInterview(interview.id)}}>🗑 Deletar</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {activeTab === "eventos" && (
      <section className="admin-card">
        <h2>GERENCIAR EVENTOS</h2>

        {editingEvent && (
          <div className="edit-post-form">
            <h3>Editando Evento</h3>
            <div className="form-group">
              <label>Título</label>
              <input
                type="text"
                value={editingEvent.title}
                onChange={(e) => setEditingEvent({...editingEvent, title: e.target.value})}
                placeholder="Título do evento"
              />
            </div>
            <div className="form-group">
              <label>Artista/Banda</label>
              <input
                type="text"
                value={editingEvent.artist}
                onChange={(e) => setEditingEvent({...editingEvent, artist: e.target.value})}
                placeholder="Nome do artista ou banda"
              />
            </div>
            <div className="form-group">
              <label>Data</label>
              <input
                type="date"
                value={editingEvent.date}
                onChange={(e) => setEditingEvent({...editingEvent, date: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Hora</label>
              <input
                type="time"
                value={editingEvent.time}
                onChange={(e) => setEditingEvent({...editingEvent, time: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Local/Venue</label>
              <input
                type="text"
                value={editingEvent.location}
                onChange={(e) => setEditingEvent({...editingEvent, location: e.target.value})}
                placeholder="Nome do local"
              />
            </div>
            <div className="form-group">
              <label>Cidade</label>
              <input
                type="text"
                value={editingEvent.city}
                onChange={(e) => setEditingEvent({...editingEvent, city: e.target.value})}
                placeholder="Cidade"
              />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <input
                type="text"
                value={editingEvent.state}
                onChange={(e) => setEditingEvent({...editingEvent, state: e.target.value})}
                placeholder="Estado (SP, RJ, etc)"
              />
            </div>
            <div className="form-group">
              <label>URL da Imagem</label>
              <input
                type="text"
                value={editingEvent.image}
                onChange={(e) => setEditingEvent({...editingEvent, image: e.target.value})}
                placeholder="URL da imagem"
              />
            </div>
            <div className="form-group">
              <label>Link de Ingressos</label>
              <input
                type="text"
                value={editingEvent.ticket_link}
                onChange={(e) => setEditingEvent({...editingEvent, ticket_link: e.target.value})}
                placeholder="URL para compra de ingressos"
              />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea
                value={editingEvent.description}
                onChange={(e) => setEditingEvent({...editingEvent, description: e.target.value})}
                placeholder="Descrição do evento"
                rows="4"
                style={{
                  padding: "10px",
                  border: "1px solid #5a5a6e",
                  borderRadius: "4px",
                  backgroundColor: "#1a1a2e",
                  color: "#fff",
                  fontFamily: "monospace"
                }}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={saveEditEvent}>Salvar</button>
              <button className="btn btn-outline" onClick={cancelEditEvent}>Cancelar</button>
            </div>
          </div>
        )}

        {!editingEvent && (
          <div className="edit-post-form">
            <h3>Novo Evento</h3>
            <div className="form-group">
              <label>Título</label>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                placeholder="Título do evento"
              />
            </div>
            <div className="form-group">
              <label>Artista/Banda</label>
              <input
                type="text"
                value={newEvent.artist}
                onChange={(e) => setNewEvent({...newEvent, artist: e.target.value})}
                placeholder="Nome do artista ou banda"
              />
            </div>
            <div className="form-group">
              <label>Data</label>
              <input
                type="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Hora</label>
              <input
                type="time"
                value={newEvent.time}
                onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Local/Venue</label>
              <input
                type="text"
                value={newEvent.location}
                onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                placeholder="Nome do local"
              />
            </div>
            <div className="form-group">
              <label>Cidade</label>
              <input
                type="text"
                value={newEvent.city}
                onChange={(e) => setNewEvent({...newEvent, city: e.target.value})}
                placeholder="Cidade"
              />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <input
                type="text"
                value={newEvent.state}
                onChange={(e) => setNewEvent({...newEvent, state: e.target.value})}
                placeholder="Estado (SP, RJ, etc)"
              />
            </div>
            <div className="form-group">
              <label>URL da Imagem</label>
              <input
                type="text"
                value={newEvent.image}
                onChange={(e) => setNewEvent({...newEvent, image: e.target.value})}
                placeholder="URL da imagem"
              />
            </div>
            <div className="form-group">
              <label>Link de Ingressos</label>
              <input
                type="text"
                value={newEvent.ticket_link}
                onChange={(e) => setNewEvent({...newEvent, ticket_link: e.target.value})}
                placeholder="URL para compra de ingressos"
              />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                placeholder="Descrição do evento"
                rows="4"
                style={{
                  padding: "10px",
                  border: "1px solid #5a5a6e",
                  borderRadius: "4px",
                  backgroundColor: "#1a1a2e",
                  color: "#fff",
                  fontFamily: "monospace"
                }}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={createEvent}>Publicar</button>
            </div>
          </div>
        )}

        <div className="events-list">
          <h3>Lista de Eventos ({events.length})</h3>
          {events.length === 0 && <p>Nenhum evento adicionado</p>}
          {events.map(event => (
            <div key={event.id} className="post-item">
              <div className="post-preview">
                {event.image && <img src={event.image} alt={event.title} />}
                <div className="post-info">
                  <h4>{event.title}</h4>
                  <p><strong>{event.artist}</strong></p>
                  <p>📅 {event.date} {event.time && `às ${event.time}`}</p>
                  <p>📍 {event.location}, {event.city} - {event.state}</p>
                  <p>{event.description ? event.description.substring(0, 100) : "Sem descrição"}...</p>
                </div>
              </div>
              <div className="post-actions">
                <button className="btn btn-primary" onClick={() => startEditEvent(event)}>✏️ Editar</button>
                <button className="btn btn-outline" onClick={() => {if (confirm("Tem certeza?")) deleteEvent(event.id)}}>🗑 Deletar</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}
    </div>
  );
}