import { useState, useEffect, useRef } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";


function parseBandMembers(value) {
  const text = String(value || "").trim();
  if (!text) return [{ name: "", role: "", instagram: "" }];
  return text.split(/\n|(?<=\.)\s+(?=[A-ZÀ-Ú])/).map((line) => {
    const parts = line.trim().replace(/[.]$/, "").split(/\s+[—–-]\s+/);
    const name = (parts.shift() || "").trim();
    const rest = parts.join(" — ");
    const instagramMatch = rest.match(/@([\w.]+)/);
    const instagram = instagramMatch ? instagramMatch[1] : "";
    const role = rest.replace(/@([\w.]+)/g, "").replace(/\s*[—–-]\s*$/, "").trim();
    return { name, role, instagram };
  }).filter((member) => member.name);
}
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
function BandMembersEditor({ members, setMembers }) {
  const update = (index, field, value) => setMembers((current) => current.map((member, i) => i === index ? { ...member, [field]: value } : member));
  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {members.map((member, index) => (
        <div key={index} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px", padding: "10px", border: "1px solid #444", borderRadius: "8px" }}>
          <input aria-label={\`Nome do integrante \${index + 1}\`} value={member.name} onChange={(e) => update(index, "name", e.target.value)} placeholder="Nome do integrante" />
          <input aria-label={\`Instrumento de \${member.name || index + 1}\`} value={member.role} onChange={(e) => update(index, "role", e.target.value)} placeholder="Instrumento / função (ex.: guitarra e composição)" />
          <input aria-label={\`Instagram de \${member.name || index + 1}\`} value={member.instagram} onChange={(e) => update(index, "instagram", e.target.value)} placeholder="Instagram (opcional, @perfil)" />
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span title="Ícone identificado automaticamente" style={{ fontSize: "22px" }}>{instrumentIcon(member.role)}</span>
            <button type="button" className="btn btn-secondary" onClick={() => setMembers((current) => current.filter((_, i) => i !== index))}>Remover</button>
          </div>
        </div>
      ))}
      <div><button type="button" className="btn btn-secondary" onClick={() => setMembers((current) => [...current, { name: "", role: "", instagram: "" }])}>+ Adicionar integrante</button></div>
      <small style={{ color: "#aaa" }}>O ícone muda automaticamente conforme o instrumento ou função informado. O Instagram é opcional.</small>
    </div>
  );
}

function normalizeInstagramUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return `https:${raw}`;

  const username = raw
    .replace(/^\/+/, "")
    .replace(/^(?:www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");
  return username ? `https://www.instagram.com/${username}/` : "";
}

export default function Admin({ user: currentUser }) {
  const [posts, setPosts] = useState([]);
  const [bands, setBands] = useState([]);
  const [pendingBands, setPendingBands] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [newPost, setNewPost] = useState({ title: "", content: "", image: "", link: "", source: "" });
  const [newBand, setNewBand] = useState({ name: "", genre: "", city: "", state: "", year: "", members: "", biography: "", contact: "", image: "", instagram: "", facebook: "", youtube: "", spotify: "", bandcamp: "", site: "" });
  const [newBandMembers, setNewBandMembers] = useState([{ name: "", role: "", instagram: "" }]);
  const [editingBandMembers, setEditingBandMembers] = useState([{ name: "", role: "", instagram: "" }]);
  const [activeTab, setActiveTab] = useState("noticias");
  const [editingPost, setEditingPost] = useState(null);
  const [selectedPosts, setSelectedPosts] = useState(new Set());
  const [editingBand, setEditingBand] = useState(null);
  const [editingInterview, setEditingInterview] = useState(null);
  const [newInterview, setNewInterview] = useState({ title: "", artist: "", content: "", image: "", date: "" });
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ title: "", artist: "", date: "", time: "", location: "", city: "", state: "", image: "", ticket_link: "", description: "" });
  const [editingEvent, setEditingEvent] = useState(null);
  const [releases, setReleases] = useState([]);
  const [newRelease, setNewRelease] = useState({ title: "", artist: "", type: "Single", release_date: "", image: "", spotify: "", youtube: "", description: "" });
  const [editingRelease, setEditingRelease] = useState(null);

  const [rssFeeds, setRssFeeds] = useState([]);
  const [rssStatuses, setRssStatuses] = useState([]);
  const [loadingRssStatuses, setLoadingRssStatuses] = useState(false);
  const [feedName, setFeedName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [feedLogo, setFeedLogo] = useState("");
  const [loadingFeeds, setLoadingFeeds] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
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
    if (currentUser && (currentUser.role === "admin" || currentUser.role === "editor")) {
      fetchData();
    }
  }, [currentUser]);

  const isAdmin = currentUser?.role === "admin";
  const isEditor = currentUser?.role === "editor";

  const handleImageUpload = (file, setter, field) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      axios.post(`${API_URL}/api/upload-image`, { image: reader.result })
        .then(res => {
          if (res.data.path) {
            setter(prev => ({ ...prev, [field]: res.data.path }));
            alert("Imagem enviada com sucesso!");
          }
        })
        .catch(() => alert("Erro ao enviar imagem"));
    };
    reader.readAsDataURL(file);
  };

  const fetchRssStatuses = async () => {
    setLoadingRssStatuses(true);
    try {
      const res = await axios.get(`${API_URL}/api/rss-status`);
      setRssStatuses(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Erro ao carregar status RSS:", err);
    } finally {
      setLoadingRssStatuses(false);
    }
  };

  const getRssStatus = (feed) => rssStatuses.find(item => Number(item.feed_id) === Number(feed.id));
  const fetchData = () => {
    axios.get(`${API_URL}/api/posts?full=1`).then(res => setPosts(res.data));
    axios.get(`${API_URL}/api/bands?full=1`).then(res => setBands(res.data));
    axios.get(`${API_URL}/api/pending-bands`).then(res => setPendingBands(res.data));
    axios.get(`${API_URL}/api/interviews?full=1`).then(res => setInterviews(res.data));
    axios.get(`${API_URL}/api/events?full=1`).then(res => setEvents(res.data));
    axios.get(`${API_URL}/api/releases?full=1`).then(res => setReleases(res.data));
    axios.get(`${API_URL}/api/rss-feeds`).then(res => setRssFeeds(res.data));
    fetchRssStatuses();
    axios.get(`${API_URL}/api/users`).then(res => setAllUsers(res.data)).catch(() => {});
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

  const execFormat = (command, value = null) => {
    document.execCommand(command, false, value);
  };

  const clearFormatting = () => {
    document.execCommand("removeFormat", false, null);
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const text = sel.toString();
      document.execCommand("insertText", false, text);
    }
  };

  const FormatToolbar = () => (
    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "6px", padding: "6px", background: "#12121f", borderRadius: "4px", border: "1px solid #2c2c38" }}>
      <button type="button" onClick={() => execFormat("bold")} style={{ background: "#2a2a3d", border: "1px solid #444", color: "#fff", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }} title="Negrito">B</button>
      <button type="button" onClick={() => execFormat("italic")} style={{ background: "#2a2a3d", border: "1px solid #444", color: "#fff", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontStyle: "italic", fontSize: "13px" }} title="Itálico">I</button>
      <button type="button" onClick={() => execFormat("underline")} style={{ background: "#2a2a3d", border: "1px solid #444", color: "#fff", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", textDecoration: "underline", fontSize: "13px" }} title="Sublinhado">U</button>
      <span style={{ borderLeft: "1px solid #444", margin: "0 4px" }}></span>
      <button type="button" onClick={() => execFormat("formatBlock", "h2")} style={{ background: "#2a2a3d", border: "1px solid #444", color: "#fff", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }} title="Título">H2</button>
      <button type="button" onClick={() => execFormat("formatBlock", "h3")} style={{ background: "#2a2a3d", border: "1px solid #444", color: "#fff", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }} title="Subtítulo">H3</button>
      <button type="button" onClick={() => execFormat("formatBlock", "p")} style={{ background: "#2a2a3d", border: "1px solid #444", color: "#fff", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }} title="Parágrafo">P</button>
      <span style={{ borderLeft: "1px solid #444", margin: "0 4px" }}></span>
      <button type="button" onClick={() => execFormat("insertUnorderedList")} style={{ background: "#2a2a3d", border: "1px solid #444", color: "#fff", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }} title="Lista">• Lista</button>
      <button type="button" onClick={() => execFormat("justifyLeft")} style={{ background: "#2a2a3d", border: "1px solid #444", color: "#fff", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }} title="Alinhar esquerda">⬅</button>
      <button type="button" onClick={() => execFormat("justifyCenter")} style={{ background: "#2a2a3d", border: "1px solid #444", color: "#fff", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }} title="Centralizar">⬌</button>
      <span style={{ borderLeft: "1px solid #444", margin: "0 4px" }}></span>
      <button type="button" onClick={() => {
        const url = prompt("URL do link:");
        if (url) {
          const newTab = confirm("Abrir em nova aba?");
          const sel = window.getSelection();
          const text = sel.toString() || url;
          const target = newTab ? ' target="_blank" rel="noopener noreferrer"' : '';
          document.execCommand("insertHTML", false, `<a href="${url}"${target} style="color:#e9b61e">${text}</a>`);
        }
      }} style={{ background: "#2a2a3d", border: "1px solid #444", color: "#fff", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }} title="Inserir link">🔗 Link</button>
      <span style={{ borderLeft: "1px solid #444", margin: "0 4px" }}></span>
      <button type="button" onClick={clearFormatting} style={{ background: "#3d2a2a", border: "1px solid #644", color: "#f88", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }} title="Limpar formatação">✕ Limpar</button>
    </div>
  );

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

    axios.post(`${API_URL}/api/posts`, { ...newPost, content: finalContent })
      .then(() => {
        setNewPost({ title: "", content: "", image: "", link: "", source: "" });
        if (newContentRef.current) {
          newContentRef.current.innerHTML = "";
        }
        fetchData();
        alert("Notícia publicada com sucesso!");
      })
      .catch((err) => alert("Erro ao publicar: " + (err.response?.data?.error || err.message)));
  };

  const deletePost = (id) => {
    axios.delete(`${API_URL}/api/posts/${id}`)
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

    axios.put(`${API_URL}/api/posts/${editingPost.id}`, {
      title: editingPost.title,
      content: finalContent,
      image: editingPost.image,
      link: editingPost.link,
      source: editingPost.source
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
    setEditingBandMembers(parseBandMembers(band.members));
  };

  const saveEditBand = () => {
    if (!editingBand.name.trim()) {
      alert("Preencha o nome da banda");
      return;
    }

    axios.put(`${API_URL}/api/bands/${editingBand.id}`, {
      name: editingBand.name,
      genre: editingBand.genre,
      city: editingBand.city,
      state: editingBand.state,
      year: editingBand.year,
      members: serializeBandMembers(editingBandMembers),
      biography: editingBand.biography,
      contact: editingBand.contact,
      image: editingBand.image,
      instagram: normalizeInstagramUrl(editingBand.instagram),
      facebook: editingBand.facebook,
      youtube: editingBand.youtube,
      spotify: editingBand.spotify,
      bandcamp: editingBand.bandcamp,
      site: editingBand.site
    })
      .then(() => {
        setEditingBand(null);
        setEditingBandMembers([{ name: "", role: "", instagram: "" }]);
        fetchData();
        alert("Banda atualizada com sucesso!");
      })
      .catch(() => alert("Erro ao atualizar banda"));
  };

  const cancelEditBand = () => {
    setEditingBand(null);
    setEditingBandMembers([{ name: "", role: "", instagram: "" }]);
  };

  const deleteBand = (id) => {
    axios.delete(`${API_URL}/api/bands/${id}`)
      .then(() => fetchData());
  };

  const toggleWeeklyFeaturedBand = async (band) => {
    const featured = !Boolean(band.is_weekly_featured);
    try {
      await axios.post(`${API_URL}/api/bands/${band.id}/weekly-featured`, { featured });
      await fetchData();
      alert(featured
        ? `${band.name} agora é a Banda da Semana!`
        : `${band.name} foi removida de Banda da Semana.`);
    } catch (err) {
      alert("Erro ao atualizar Banda da Semana: " + (err.response?.data?.error || err.message));
    }
  };

  const createBand = () => {
    if (!newBand.name.trim()) {
      alert("Preencha o nome da banda");
      return;
    }

    axios.post(`${API_URL}/api/bands`, { ...newBand, members: serializeBandMembers(newBandMembers) })
      .then(() => {
        setNewBand({ name: "", genre: "", city: "", state: "", year: "", members: "", biography: "", contact: "", image: "", instagram: "", facebook: "", youtube: "", spotify: "", bandcamp: "", site: "" });
        setNewBandMembers([{ name: "", role: "", instagram: "" }]);
        fetchData();
        alert("Banda adicionada com sucesso!");
      })
      .catch((err) => alert("Erro ao adicionar banda: " + (err.response?.data?.error || err.message)));
  };

  const cancelCreateBand = () => {
    setNewBand({ name: "", genre: "", city: "", state: "", year: "", members: "", biography: "", contact: "", image: "", instagram: "", facebook: "", youtube: "", spotify: "", bandcamp: "", site: "" });
    setNewBandMembers([{ name: "", role: "", instagram: "" }]);
  };

  const approveBand = (id) => {
    axios.post(`${API_URL}/api/approve-band/${id}`)
      .then(() => fetchData());
  };

  const createInterview = () => {
    if (!newInterview.title.trim() || !newInterview.artist.trim()) {
      alert("Preencha título e artista");
      return;
    }

    axios.post(`${API_URL}/api/interviews`, newInterview)
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

    axios.put(`${API_URL}/api/interviews/${editingInterview.id}`, {
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
    axios.delete(`${API_URL}/api/interviews/${id}`)
      .then(() => {
        alert("Entrevista deletada com sucesso!");
        fetchData();
      })
      .catch((err) => alert("Erro ao deletar entrevista: " + (err.response?.data?.error || err.message)));
  };

  // ====== LANÇAMENTOS ======
  const createRelease = () => {
    if (!newRelease.title.trim() || !newRelease.artist.trim()) return alert("Preencha título e banda/artista");
    axios.post(API_URL + "/api/releases", newRelease).then(() => { setNewRelease({ title:"", artist:"", type:"Single", release_date:"", image:"", spotify:"", youtube:"", description:"" }); fetchData(); alert("Lançamento publicado!"); }).catch(err => alert(err.response?.data?.error || "Erro ao publicar lançamento"));
  };
  const saveEditRelease = () => {
    if (!editingRelease.title.trim() || !editingRelease.artist.trim()) return alert("Preencha título e banda/artista");
    axios.put(API_URL + "/api/releases/" + editingRelease.id, editingRelease).then(() => { setEditingRelease(null); fetchData(); alert("Lançamento atualizado!"); }).catch(err => alert(err.response?.data?.error || "Erro ao atualizar lançamento"));
  };
  const deleteRelease = async (id) => {
    if (!confirm("Excluir este lançamento?")) return;
    try {
      const response = await axios.delete(API_URL + "/api/releases/" + id, {
        headers: { "Cache-Control": "no-cache" }
      });
      if (response.data?.success) {
        setReleases(current => current.filter(item => String(item.id) !== String(id)));
        alert("Lançamento excluído com sucesso.");
        fetchData();
      } else {
        alert("A API não confirmou a exclusão do lançamento.");
      }
    } catch (err) {
      alert("Não foi possível excluir o lançamento: " + (err.response?.data?.error || err.message));
      fetchData();
    }
  };

  // ====== EVENTOS ======
  const createEvent = () => {
    if (!newEvent.title.trim() || !newEvent.date) {
      alert("Preencha pelo menos o título e a data");
      return;
    }

    axios.post(`${API_URL}/api/events`, newEvent)
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

    axios.put(`${API_URL}/api/events/${editingEvent.id}`, {
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
    axios.delete(`${API_URL}/api/events/${id}`)
      .then(() => {
        alert("Evento deletado com sucesso!");
        fetchData();
      })
      .catch((err) => alert("Erro ao deletar evento: " + (err.response?.data?.error || err.message)));
  };

  const approveEvent = async (id) => {
    try {
      await axios.put(API_URL + "/api/events/" + id + "/status", { status: "approved" });
      await fetchData();
      alert("Evento aprovado e publicado na página de eventos!");
    } catch (err) {
      alert("Erro ao aprovar evento: " + (err.response?.data?.error || err.message));
    }
  };

  const addRssFeed = async () => {
    if (!feedName.trim() || !feedUrl.trim()) {
      alert("Preencha nome e URL do feed");
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/api/rss-feeds`, { 
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
      const res = await axios.delete(`${API_URL}/api/rss-feeds/${index}`);
      
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
      const res = await axios.put(`${API_URL}/api/rss-feeds/${index}/logo`, {
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
      const res = await axios.put(`${API_URL}/api/rss-feeds/${editingFeedId}`, {
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
      const res = await axios.post(`${API_URL}/api/import-rss`, { feeds: rssFeeds });

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
      const res = await axios.post(`${API_URL}/api/reimport-rss`, { feeds: rssFeeds });

      if (res.data && res.data.success) {
        alert(`Reimportação concluída: ${res.data.updated} notícia(s) atualizadas com resumo seguro e ${res.data.created} novas criadas!`);
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
      const res = await axios.post(`${API_URL}/api/import-rss-single`, { feed });

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
      const res = await axios.post(`${API_URL}/api/fix-missing-images`);

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
      const res = await axios.post(`${API_URL}/api/test-rss-images`, { feedUrl });

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

  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "editor")) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <h1>PAINEL ADMIN</h1>
          <p>Acesso restrito — faça login para continuar</p>
          <p style={{ color: "#888", fontSize: "13px", marginBottom: "16px" }}>
            {currentUser ? "Sua conta não tem permissão de acesso ao painel." : "Você precisa estar logado."}
          </p>
          <a href="/login" className="btn btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
            {currentUser ? "Voltar" : "Fazer Login"}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div>
          <h1>PAINEL <span>ADMIN</span></h1>
          <p>Logado como <strong>{currentUser.display_name || currentUser.username}</strong> ({currentUser.role})</p>
        </div>
        <a href="/" className="btn btn-outline" style={{ textDecoration: "none" }}>Voltar ao site</a>
      </header>

      <div className="admin-tabs">
        {isAdmin && <button className={activeTab === "rss" ? "active" : ""} onClick={() => setActiveTab("rss")}>RSS</button>}
        <button className={activeTab === "noticias" ? "active" : ""} onClick={() => setActiveTab("noticias")}>NOTÍCIAS</button>
        {isAdmin && <button className={activeTab === "bandas" ? "active" : ""} onClick={() => setActiveTab("bandas")}>BANDAS</button>}
        {isAdmin && <button className={activeTab === "entrevistas" ? "active" : ""} onClick={() => setActiveTab("entrevistas")}>ENTREVISTAS</button>}
        <button className={activeTab === "eventos" ? "active" : ""} onClick={() => setActiveTab("eventos")}>EVENTOS</button>
        {isAdmin && <button className={activeTab === "lancamentos" ? "active" : ""} onClick={() => setActiveTab("lancamentos")}>LANÇAMENTOS</button>}
        {isAdmin && <button className={activeTab === "usuarios" ? "active" : ""} onClick={() => setActiveTab("usuarios")}>USUÁRIOS</button>}
      </div>

      {activeTab === "rss" && (
      <section className="admin-card">
        <h2>FEEDS RSS</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <p style={{ color: "#aaa", margin: 0, fontSize: "13px" }}>Acompanhe a última verificação automática de cada fonte.</p>
          <button className="btn btn-outline" onClick={fetchRssStatuses} disabled={loadingRssStatuses}>
            {loadingRssStatuses ? "Consultando..." : "↻ Atualizar status"}
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px", fontSize: "12px" }}>
          <span style={{ padding: "5px 9px", borderRadius: "5px", background: "#173d2a", color: "#8ee5a4" }}>● Atualizou</span>
          <span style={{ padding: "5px 9px", borderRadius: "5px", background: "#40351a", color: "#f4d27b" }}>● Sem novidades</span>
          <span style={{ padding: "5px 9px", borderRadius: "5px", background: "#461f25", color: "#ff9ba4" }}>● Erro</span>
        </div>
        <div className="edit-post-form">
          <h3>Novo Feed RSS</h3>
          <div className="form-group">
            <label>Nome do Feed</label>
            <input
              type="text"
              placeholder="Ex: Rolling Stone Brasil"
              value={feedName}
              onChange={(e) => setFeedName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>URL do Feed RSS</label>
            <input
              type="text"
              placeholder="https://exemplo.com/feed/"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>URL da Logo (opcional)</label>
            <input
              type="text"
              placeholder="https://exemplo.com/logo.png"
              value={feedLogo}
              onChange={(e) => setFeedLogo(e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={addRssFeed}>Adicionar Feed</button>
          </div>
        </div>

        {rssFeeds.length === 0 ? (
          <p style={{ color: "#afafba" }}>Nenhum feed adicionado</p>
        ) : (
          rssFeeds.map((feed, index) => (
            <div key={`${feed.url}-${index}`} className="rss-row" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "start", padding: "12px", backgroundColor: "#1a1a1a", borderRadius: "8px", marginBottom: "12px", borderLeft: "3px solid #e9b61e" }}>
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
                    {(() => {
                      const status = getRssStatus(feed);
                      const statusStyle = status?.status === "updated"
                        ? { background: "#173d2a", color: "#8ee5a4", label: "Atualizou" }
                        : status?.status === "no_new"
                          ? { background: "#40351a", color: "#f4d27b", label: "Sem novidades" }
                          : status?.status === "error"
                            ? { background: "#461f25", color: "#ff9ba4", label: "Erro" }
                            : { background: "#30303a", color: "#c4c4ce", label: "Ainda não verificado" };
                      return (
                        <div style={{ marginTop: "8px", padding: "8px", borderRadius: "6px", background: statusStyle.background, color: statusStyle.color, fontSize: "12px", overflowWrap: "anywhere" }}>
                          <strong>{statusStyle.label}</strong>
                          {status?.message && <div style={{ marginTop: "3px" }}>{status.message}</div>}
                          {status?.checked_at && <div style={{ marginTop: "3px", opacity: 0.8 }}>Última verificação: {new Date(status.checked_at).toLocaleString("pt-BR")}</div>}
                          {status && <div style={{ marginTop: "3px", opacity: 0.8 }}>Itens no feed: {status.item_count ?? 0} · Novas: {status.imported_count ?? 0}{Number(status.updated_count || 0) > 0 ? ` · Atualizadas: ${status.updated_count}` : ""}</div>}
                        </div>
                      );
                    })()}
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
              <FormatToolbar />
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
              <label>Fonte</label>
              <input
                type="text"
                value={editingPost.source || ""}
                onChange={(e) => setEditingPost({...editingPost, source: e.target.value})}
                placeholder="Ex: Comunidade do Rock, Rolling Stone..."
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
              <FormatToolbar />
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
              <label>Fonte</label>
              <input
                type="text"
                value={newPost.source || ""}
                onChange={(e) => setNewPost({...newPost, source: e.target.value})}
                placeholder="Ex: Comunidade do Rock, Rolling Stone..."
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
          {isAdmin && <div style={{marginBottom: "16px", display: "flex", gap: "8px", flexWrap: "wrap"}}>
            <button className="btn btn-outline" onClick={reimportRssFeeds}>🔄 Reimportar e Atualizar Imagens</button>
            <button className="btn btn-outline" onClick={() => {
              if (selectedPosts.size === posts.length) {
                setSelectedPosts(new Set());
              } else {
                setSelectedPosts(new Set(posts.map(p => p.id)));
              }
            }}>{selectedPosts.size === posts.length ? "☐ Desmarcar todas" : "☑ Selecionar todas"}</button>
            {selectedPosts.size > 0 && (
              <button className="btn btn-outline" style={{ color: "#f44", borderColor: "#f44" }} onClick={() => {
                if (confirm(`Deletar ${selectedPosts.size} notícia(s) selecionada(s)?`)) {
                  Promise.all([...selectedPosts].map(id => axios.delete(`${API_URL}/api/posts/${id}`))).then(() => {
                    setSelectedPosts(new Set());
                    fetchData();
                    alert(`${selectedPosts.size} notícia(s) deletada(s)!`);
                  }).catch(() => alert("Erro ao deletar"));
                }
              }}>🗑 Deletar selecionadas ({selectedPosts.size})</button>
            )}
          </div>}
          {posts.length === 0 && <p>Nenhuma notícia publicada</p>}
          {posts.map(post => (
            <div key={post.id} className="post-item" style={{ background: selectedPosts.has(post.id) ? "#1a1a3a" : undefined }}>
              {isAdmin && <input type="checkbox" checked={selectedPosts.has(post.id)} onChange={() => {
                const next = new Set(selectedPosts);
                if (next.has(post.id)) next.delete(post.id); else next.add(post.id);
                setSelectedPosts(next);
              }} style={{ accentColor: "#e9b61e", width: "18px", height: "18px", flexShrink: 0 }} />}
              <div className="post-preview">
                {post.image && <img src={getImageUrl(post.image)} alt={post.title} />}
                <div className="post-info">
                  <h4>{post.title}</h4>
                  <p>{(post.content || "").substring(0, 100)}...</p>
                </div>
              </div>
              <div className="post-actions">
                <button className="btn btn-primary" onClick={() => startEditPost(post)}>✏️ Editar</button>
                {isAdmin && <button className="btn btn-outline" onClick={() => {if (confirm("Tem certeza?")) deletePost(post.id)}}>🗑 Deletar</button>}
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {activeTab === "bandas" && (
      <section className="admin-card">
        <h2>GERENCIAR BANDAS</h2>

        <div className="bands-pending-section">
          <h3>Bandas Pendentes ({pendingBands.length})</h3>
          {pendingBands.length === 0 && <p>Nenhuma banda pendente</p>}
          {pendingBands.map(b => (
            <div key={b.id} className="post-item">
              <div className="post-preview">
                {b.image && <img src={getImageUrl(b.image)} alt={b.name} />}
                <div className="post-info">
                  <h4>{b.name}</h4>
                  <p><strong>{b.genre}</strong> - {b.city}/{b.state}</p>
                  {b.year && <p>Formação: {b.year}</p>}
                  <p>{b.biography ? b.biography.substring(0, 100) : "Sem descrição"}...</p>
                  {b.instagram && <small>📷 {b.instagram}</small>}
                  {b.contact && <small> · 📧 {b.contact}</small>}
                </div>
              </div>
              <div className="post-actions">
                <button className="btn btn-primary" onClick={() => approveBand(b.id)}>✅ Aprovar</button>
                <button className="btn btn-outline" onClick={() => {
                  if (confirm(`Rejeitar a banda ${b.name}?`)) {
                    axios.delete(`${API_URL}/api/pending-bands/${b.id}`).then(() => fetchData()).catch(() => alert("Erro ao rejeitar"));
                  }
                }}>❌ Rejeitar</button>
              </div>
            </div>
          ))}
        </div>

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
              <BandMembersEditor members={editingBandMembers} setMembers={setEditingBandMembers} />
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
                placeholder="URL da imagem (ou envie um arquivo abaixo)"
              />
              <input
                type="file"
                accept="image/*"
                aria-label="Enviar imagem da banda"
                style={{ marginTop: "8px" }}
                onChange={(e) => {
                  handleImageUpload(e.target.files?.[0], setEditingBand, "image");
                  e.target.value = "";
                }}
              />
              {editingBand.image && (
                <img
                  src={getImageUrl(editingBand.image)}
                  alt="Prévia da imagem da banda"
                  style={{ display: "block", maxWidth: "180px", maxHeight: "140px", objectFit: "cover", marginTop: "10px", borderRadius: "6px" }}
                />
              )}
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
                <BandMembersEditor members={newBandMembers} setMembers={setNewBandMembers} />
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
                  placeholder="URL da imagem (ou envie um arquivo abaixo)"
                />
                <input
                  type="file"
                  accept="image/*"
                  aria-label="Enviar imagem da banda"
                  style={{ marginTop: "8px" }}
                  onChange={(e) => {
                    handleImageUpload(e.target.files?.[0], setNewBand, "image");
                    e.target.value = "";
                  }}
                />
                {newBand.image && (
                  <img
                    src={getImageUrl(newBand.image)}
                    alt="Prévia da imagem da banda"
                    style={{ display: "block", maxWidth: "180px", maxHeight: "140px", objectFit: "cover", marginTop: "10px", borderRadius: "6px" }}
                  />
                )}
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
                    {band.image && <img src={getImageUrl(band.image)} alt={band.name} />}
                    <div className="post-info">
                      <h4>{band.name}</h4>
                      <p><strong>{band.genre}</strong> - {band.city}/{band.state}</p>
                      <p>{band.biography ? band.biography.substring(0, 100) : "Sem descrição"}...</p>
                    </div>
                  </div>
                  <div className="post-actions" style={{ flexWrap: "wrap" }}>
                    <button
                      className={band.is_weekly_featured ? "btn btn-primary" : "btn btn-outline"}
                      onClick={() => toggleWeeklyFeaturedBand(band)}
                      title={band.is_weekly_featured ? "Remover da Banda da Semana" : "Definir como Banda da Semana"}
                    >
                      {band.is_weekly_featured ? "⭐ Banda da Semana (remover)" : "⭐ Definir como Banda da Semana"}
                    </button>
                    <button className="btn btn-primary" onClick={() => startEditBand(band)}>✏️ Editar</button>
                    <button className="btn btn-outline" onClick={() => {if (confirm("Tem certeza que deseja deletar esta banda?")) deleteBand(band.id)}}>🗑 Deletar</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}


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
                {interview.image && <img src={getImageUrl(interview.image)} alt={interview.title} />}
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

      {activeTab === "lancamentos" && isAdmin && (
      <section className="admin-card">
        <h2>GERENCIAR LANÇAMENTOS</h2>
        <div className="edit-post-form">
          <h3>Novo lançamento</h3>
          <div className="form-group"><label>Título</label><input value={newRelease.title} onChange={e=>setNewRelease({...newRelease,title:e.target.value})} placeholder="Nome do single, EP ou álbum" /></div>
          <div className="form-group"><label>Banda / Artista</label><input value={newRelease.artist} onChange={e=>setNewRelease({...newRelease,artist:e.target.value})} /></div>
          <div className="form-group"><label>Tipo</label><select value={newRelease.type} onChange={e=>setNewRelease({...newRelease,type:e.target.value})}><option>Single</option><option>EP</option><option>Álbum</option><option>Videoclipe</option></select></div>
          <div className="form-group"><label>Data de lançamento</label><input type="date" value={newRelease.release_date} onChange={e=>setNewRelease({...newRelease,release_date:e.target.value})} /></div>
          <div className="form-group"><label>Imagem</label><input value={newRelease.image} onChange={e=>setNewRelease({...newRelease,image:e.target.value})} /><input type="file" accept="image/*" onChange={e=>handleImageUpload(e.target.files?.[0], setNewRelease, "image")} /></div>
          <div className="form-group"><label>Spotify</label><input value={newRelease.spotify} onChange={e=>setNewRelease({...newRelease,spotify:e.target.value})} /></div>
          <div className="form-group"><label>YouTube / Clipe</label><input value={newRelease.youtube} onChange={e=>setNewRelease({...newRelease,youtube:e.target.value})} /></div>
          
          <div className="form-actions"><button className="btn btn-primary" onClick={createRelease}>Publicar lançamento</button></div>
        </div>
        <div className="interviews-list">
          <h3>Lançamentos publicados ({releases.length})</h3>
          {releases.map(r=><div key={r.id} className="post-item"><div className="post-preview">{r.image&&<img src={getImageUrl(r.image)} alt={r.title}/>}<div className="post-info"><h4>{r.title}</h4><p><strong>{r.artist}</strong> · {r.type}</p>{r.release_date&&<small>{r.release_date}</small>}</div></div><div className="post-actions"><button className="btn btn-primary" onClick={()=>setEditingRelease({...r})}>✏️ Editar</button><button className="btn btn-outline" onClick={()=>deleteRelease(r.id)}>🗑 Deletar</button></div></div>)}
        </div>
        {editingRelease && <div className="edit-post-form"><h3>Editando lançamento</h3><div className="form-group"><label>Título</label><input value={editingRelease.title} onChange={e=>setEditingRelease({...editingRelease,title:e.target.value})}/></div><div className="form-group"><label>Banda / Artista</label><input value={editingRelease.artist} onChange={e=>setEditingRelease({...editingRelease,artist:e.target.value})}/></div><div className="form-group"><label>Tipo</label><input value={editingRelease.type||"Single"} onChange={e=>setEditingRelease({...editingRelease,type:e.target.value})}/></div><div className="form-group"><label>Data</label><input type="date" value={editingRelease.release_date||""} onChange={e=>setEditingRelease({...editingRelease,release_date:e.target.value})}/></div><div className="form-group"><label>Imagem</label><input value={editingRelease.image||""} onChange={e=>setEditingRelease({...editingRelease,image:e.target.value})}/></div><div className="form-group"><label>Spotify</label><input value={editingRelease.spotify||""} onChange={e=>setEditingRelease({...editingRelease,spotify:e.target.value})}/></div><div className="form-group"><label>YouTube</label><input value={editingRelease.youtube||""} onChange={e=>setEditingRelease({...editingRelease,youtube:e.target.value})}/></div><div className="form-actions"><button className="btn btn-primary" onClick={saveEditRelease}>Salvar</button><button className="btn btn-outline" onClick={()=>setEditingRelease(null)}>Cancelar</button></div></div>}
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
              <input type="file" accept="image/*" style={{ marginTop: "8px" }} onChange={(e) => handleImageUpload(e.target.files[0], setEditingEvent, "image")} />
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
              <input type="file" accept="image/*" style={{ marginTop: "8px" }} onChange={(e) => handleImageUpload(e.target.files[0], setNewEvent, "image")} />
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
          <h3>Lista de Eventos ({events.length}) · {events.filter(event => event.status === "pending").length} aguardando aprovação</h3>
          {events.length === 0 && <p>Nenhum evento adicionado</p>}
          {events.map(event => (
            <div key={event.id} className="post-item">
              <div className="post-preview">
                {event.image && <img src={getImageUrl(event.image)} alt={event.title} />}
                <div className="post-info">
                  <h4>{event.title} {event.status === "pending" ? <span style={{ color: "#e9b61e", fontSize: "12px" }}>• AGUARDANDO APROVAÇÃO</span> : <span style={{ color: "#8fd694", fontSize: "12px" }}>• PUBLICADO</span>}</h4>
                  <p><strong>{event.artist}</strong></p>
                  <p>📅 {event.date} {event.time && `às ${event.time}`}</p>
                  <p>📍 {event.location}, {event.city} - {event.state}</p>
                  <p>{event.description ? event.description.substring(0, 100) : "Sem descrição"}...</p>
                  {event.contact_email && <p>Contato enviado: {event.contact_email}</p>}
                </div>
              </div>
              <div className="post-actions">
                {isAdmin && event.status === "pending" && <button className="btn btn-primary" onClick={() => approveEvent(event.id)}>✓ Aprovar e publicar</button>}
                <button className="btn btn-primary" onClick={() => startEditEvent(event)}>✏️ Editar</button>
                {isAdmin && <button className="btn btn-outline" onClick={() => {if (confirm(event.status === "pending" ? "Rejeitar e excluir este envio?" : "Tem certeza que deseja excluir este evento?")) deleteEvent(event.id)}}>🗑 {event.status === "pending" ? "Rejeitar" : "Deletar"}</button>}
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {activeTab === "usuarios" && isAdmin && (
      <section className="admin-card">
        <h2>GERENCIAR USUÁRIOS</h2>
        <p style={{ color: "#888", marginBottom: "16px" }}>Total: {allUsers.length} usuário(s) cadastrado(s)</p>
        {allUsers.length === 0 && <p>Nenhum usuário cadastrado</p>}
        {allUsers.map(u => (
          <div key={u.id} className="post-item" style={{ alignItems: "center" }}>
            <div className="post-preview" style={{ alignItems: "center" }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
                background: u.avatar ? `url(${u.avatar}) center/cover` : "#e9b61e",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px", color: "#fff", border: "2px solid #333"
              }}>
                {!u.avatar && (u.display_name || u.username || "U").charAt(0).toUpperCase()}
              </div>
              <div className="post-info">
                <h4>{u.display_name || u.username}</h4>
                <p>@{u.username} · {u.role} · Desde {new Date(u.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
            </div>
            <div className="post-actions" style={{ alignItems: "center" }}>
              <select
                value={u.role}
                onChange={async (e) => {
                  try {
                    await axios.put(`${API_URL}/api/user/${u.id}/role`, { role: e.target.value });
                    fetchData();
                  } catch (err) {
                    alert(err.response?.data?.error || "Erro ao mudar role");
                  }
                }}
                style={{ background: "#1a1a2e", color: "#fff", border: "1px solid #444", borderRadius: "4px", padding: "6px 8px", fontSize: "12px" }}
              >
                <option value="user">user</option>
                <option value="editor">editor</option>
                <option value="admin">admin</option>
              </select>
              {u.role !== "admin" && (
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    if (confirm(`Deletar o usuário @${u.username}?`)) {
                      axios.delete(`${API_URL}/api/user/${u.id}`)
                        .then(() => fetchData())
                        .catch(err => alert(err.response?.data?.error || "Erro ao deletar"));
                    }
                  }}
                  style={{ fontSize: "12px", padding: "6px 10px" }}
                >
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
      )}
    </div>
  );
}
