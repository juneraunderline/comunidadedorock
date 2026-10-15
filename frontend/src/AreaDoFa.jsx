import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

const panelStyle = {
  background: "#111118",
  border: "1px solid #292936",
  borderRadius: "12px",
  padding: "18px"
};
function safePostUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch { return ""; }
}
function safeNotificationLink(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const link = value.trim();
  if (link.startsWith("/") && !link.startsWith("//") && !link.includes(String.fromCharCode(92))) return link;
  return safePostUrl(link);
}

const buttonStyle = {
  border: "1px solid #e9b61e",
  borderRadius: "7px",
  background: "#e9b61e",
  color: "#101014",
  padding: "9px 12px",
  fontWeight: 800,
  cursor: "pointer"
};

function AreaDoFa({ user }) {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [bands, setBands] = useState([]);
  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [voteData, setVoteData] = useState({ bands: [], voted_band_id: null, week_start: null });
  const [notifications, setNotifications] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const headers = useCallback(() => {
    const token = localStorage.getItem("cdr_session_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    // Nunca consultar nem alterar dados reais a partir de uma prévia Vercel.
    // A prévia ainda não possui banco isolado; API_URL aponta para a API oficial.
    if (window.location.hostname.endsWith(".vercel.app") && API_URL === "https://comunidadedorock-api.vercel.app") {
      setError("Prévia protegida: os testes com dados reais estão bloqueados até existir um banco de teste isolado.");
      setLoading(false);
      return;
    }
    try {
      const [personal, bandResponse, eventResponse] = await Promise.all([
        axios.get(`${API_URL}/api/fan/data`, { headers: headers(), timeout: 15000 }),
        axios.get(`${API_URL}/api/bands`, { params: { limit: 50, sort: "recent" }, timeout: 15000 }),
        axios.get(`${API_URL}/api/events`, { params: { limit: 100 }, timeout: 15000 })
      ]);
      setFavorites(Array.isArray(personal.data.favorites) ? personal.data.favorites : []);
      setWatchlist(Array.isArray(personal.data.watchlist) ? personal.data.watchlist : []);
      setBands(Array.isArray(bandResponse.data) ? bandResponse.data : []);
      setEvents(Array.isArray(eventResponse.data) ? eventResponse.data : []);
      // O feed é complementar: falha nele não impede favoritos e eventos.
      try {
        const postResponse = await axios.get(`${API_URL}/api/posts`, { params: { limit: 100, offset: 0 }, timeout: 15000 });
        setPosts(Array.isArray(postResponse.data) ? postResponse.data : []);
      } catch {
        setPosts([]);
      }
      // Recursos da segunda fase são independentes: falhas não bloqueiam a Área do Fã.
      const [voteResult, notificationResult, commentResult] = await Promise.allSettled([
        axios.get(`${API_URL}/api/fan/vote`, { headers: headers(), timeout: 15000 }),
        axios.get(`${API_URL}/api/fan/notifications`, { headers: headers(), timeout: 15000 }),
        axios.get(`${API_URL}/api/comments/fan-area/1`, { timeout: 15000 })
      ]);
      if (voteResult.status === "fulfilled") setVoteData(voteResult.value.data || { bands: [], voted_band_id: null, week_start: null });
      if (notificationResult.status === "fulfilled") setNotifications(Array.isArray(notificationResult.value.data) ? notificationResult.value.data : []);
      if (commentResult.status === "fulfilled") setComments(Array.isArray(commentResult.value.data) ? commentResult.value.data : []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Sua sessão expirou. Entre novamente para acessar sua área.");
      } else {
        setError(err.response?.data?.error || "Não foi possível carregar sua área agora. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true, state: { from: "/minha-area" } });
      return;
    }
    loadData();
  }, [user, navigate, loadData]);

  const favoriteIds = useMemo(() => new Set(favorites.map(item => Number(item.id))), [favorites]);
  const watchlistIds = useMemo(() => new Set(watchlist.map(item => Number(item.id))), [watchlist]);
  const personalizedPosts = useMemo(() => {
    if (!favorites.length) return [];
    const favoriteNames = favorites.map(band => String(band.name || "").trim()).filter(name => name.length >= 2);
    if (!favoriteNames.length) return [];
    return posts.filter(post => {
      const haystack = [post.title, post.content, post.source].map(value => String(value || "")).join(" ").toLocaleLowerCase("pt-BR");
      return favoriteNames.some(name => haystack.includes(name.toLocaleLowerCase("pt-BR")));
    }).slice(0, 12);
  }, [favorites, posts]);

  const matchingBands = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return bands.filter(band => !favoriteIds.has(Number(band.id)) && (!query ||
      [band.name, band.genre, band.city, band.state].some(value => String(value || "").toLocaleLowerCase("pt-BR").includes(query))
    )).slice(0, 12);
  }, [bands, favoriteIds, search]);

  const toggleFavorite = async (band) => {
    const id = Number(band.id);
    setSaving(`band-${id}`); setError(""); setMessage("");
    try {
      if (favoriteIds.has(id)) {
        await axios.delete(`${API_URL}/api/fan/favorites/${id}`, { headers: headers() });
        setFavorites(current => current.filter(item => Number(item.id) !== id));
        setMessage(`${band.name} removida das suas bandas favoritas.`);
      } else {
        await axios.post(`${API_URL}/api/fan/favorites`, { band_id: id }, { headers: headers() });
        setFavorites(current => [{ ...band, favorited_at: new Date().toISOString() }, ...current]);
        setMessage(`${band.name} adicionada às suas bandas favoritas.`);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível atualizar suas bandas favoritas.");
    } finally {
      setSaving("");
    }
  };

  const toggleEvent = async (event) => {
    const id = Number(event.id);
    setSaving(`event-${id}`); setError(""); setMessage("");
    try {
      if (watchlistIds.has(id)) {
        await axios.delete(`${API_URL}/api/fan/events/${id}`, { headers: headers() });
        setWatchlist(current => current.filter(item => Number(item.id) !== id));
        setMessage("Evento removido da sua lista.");
      } else {
        await axios.post(`${API_URL}/api/fan/events`, { event_id: id }, { headers: headers() });
        setWatchlist(current => [{ ...event, saved_at: new Date().toISOString() }, ...current]);
        setMessage("Evento salvo na sua lista de shows.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível atualizar sua lista de shows.");
    } finally {
      setSaving("");
    }
  };


  const castVote = async (band) => {
    setSaving("vote"); setError(""); setMessage("");
    try {
      await axios.post(`${API_URL}/api/fan/vote`, { band_id: Number(band.id) }, { headers: headers() });
      setVoteData(current => ({ ...current, voted_band_id: Number(band.id), bands: current.bands.map(item => ({ ...item, votes: Number(item.votes || 0) + (Number(item.id) === Number(band.id) ? 1 : 0) })) }));
      setMessage(`Seu voto em ${band.name} foi registrado. Valeu por participar!`);
    } catch (err) { setError(err.response?.data?.error || "Não foi possível registrar seu voto."); }
    finally { setSaving(""); }
  };
  const markNotificationRead = async (notification) => {
    try {
      await axios.post(`${API_URL}/api/fan/notifications/${notification.id}/read`, {}, { headers: headers() });
      setNotifications(current => current.map(item => Number(item.id) === Number(notification.id) ? { ...item, is_read: true } : item));
    } catch (err) { setError(err.response?.data?.error || "Não foi possível atualizar a notificação."); }
  };
  const submitComment = async (event) => {
    event.preventDefault();
    const content = commentText.trim();
    if (content.length < 2 || content.length > 1000) { setError("O comentário precisa ter entre 2 e 1000 caracteres."); return; }
    setSaving("comment"); setError(""); setMessage("");
    try {
      const response = await axios.post(`${API_URL}/api/comments`, { page_type: "fan-area", page_id: 1, content }, { headers: headers() });
      if (response.data?.comment) setComments(current => [response.data.comment, ...current]);
      setCommentText(""); setMessage("Comentário publicado na comunidade.");
    } catch (err) { setError(err.response?.data?.error || "Não foi possível publicar seu comentário."); }
    finally { setSaving(""); }
  };

  const formatDate = (value) => {
    if (!value) return "Data a confirmar";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (!user) return null;

  return (
    <main style={{ minHeight: "75vh", background: "#0a0a0e", color: "#f5f5f7", padding: "34px 18px 60px" }}>
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <div style={{ marginBottom: "26px" }}>
          <p style={{ color: "#e9b61e", fontWeight: 800, letterSpacing: "2px", fontSize: "12px", marginBottom: "8px" }}>SEU ESPAÇO NA CENA</p>
          <h1 style={{ margin: 0, color: "#ffffff", fontSize: "clamp(28px, 5vw, 42px)" }}>MINHA <span style={{ color: "#e9b61e" }}>ÁREA</span></h1>
          <p style={{ color: "#a6a6b3", lineHeight: 1.6, maxWidth: "700px" }}>Guarde as bandas que você curte e monte sua lista de shows para acompanhar. Tudo fica vinculado à sua conta.</p>
        </div>

        <section className="fan-area-section-card" style={{ marginBottom: "32px" }} aria-labelledby="feed-personalizado-title">
          <h2 id="feed-personalizado-title" style={{ margin: "0 0 8px", fontSize: "22px" }}>📰 Notícias das suas bandas</h2>
          <p style={{ color: "#aaa", lineHeight: 1.6, margin: "0 0 14px" }}>Novidades encontradas nas notícias RSS que mencionam as bandas que você favoritou.</p>
          {favorites.length === 0 ? (
            <div style={panelStyle}><p style={{ margin: 0, color: "#bbb" }}>Favorite algumas bandas para montar seu feed personalizado.</p><Link to="/bandas" style={{ color: "#e9b61e", display: "inline-block", marginTop: "10px" }}>Explorar bandas →</Link></div>
          ) : personalizedPosts.length === 0 ? (
            <div style={panelStyle}><p style={{ margin: 0, color: "#bbb" }}>Ainda não encontramos notícias recentes que mencionem suas bandas favoritas. Quando uma notícia importada citar uma delas, ela aparecerá aqui.</p><Link to="/noticias" style={{ color: "#e9b61e", display: "inline-block", marginTop: "10px" }}>Ver todas as notícias →</Link></div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: "12px" }}>
              {personalizedPosts.map((post, index) => {
                const url = safePostUrl(post.link);
                const excerpt = String(post.content || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
                return <article key={post.id || index} style={{ ...panelStyle, display: "flex", flexDirection: "column", gap: "8px" }}>
                  {post.image && <img src={getImageUrl(post.image)} alt="" loading="lazy" style={{ width: "100%", height: "150px", objectFit: "cover", borderRadius: "7px" }} />}
                  <p style={{ color: "#e9b61e", fontSize: "12px", fontWeight: 800, margin: 0 }}>{post.source || "Comunidade do Rock"}</p>
                  <h3 style={{ fontSize: "17px", lineHeight: 1.4, margin: 0 }}>{post.title || "Notícia"}</h3>
                  {excerpt && <p style={{ color: "#aaa", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>{excerpt.slice(0, 180)}{excerpt.length > 180 ? "…" : ""}</p>}
                  {url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#e9b61e", fontWeight: 700, fontSize: "13px", marginTop: "auto" }}>Ler no portal original ↗</a> : <span style={{ color: "#777", fontSize: "12px" }}>Link original indisponível</span>}
                </article>;
              })}
            </div>
          )}
        </section>


        <section className="fan-area-section-card" style={{ marginBottom: "32px" }} aria-labelledby="votacao-fas-title">
          <h2 id="votacao-fas-title" style={{ margin: "0 0 8px", fontSize: "22px" }}>🏆 Votação da Banda da Semana</h2>
          <p style={{ color: "#aaa", lineHeight: 1.6, margin: "0 0 14px" }}>Escolha sua favorita. Cada conta pode votar uma vez por semana; a votação reabre na segunda-feira.</p>
          {voteData.voted_band_id && <div style={{ ...panelStyle, marginBottom: "12px" }} role="status">Seu voto desta semana já foi registrado. Obrigado por fortalecer a cena independente!</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "12px" }}>
            {(voteData.bands || []).map(band => <article key={band.id} style={{ ...panelStyle, borderColor: Number(band.id) === Number(voteData.voted_band_id) ? "#e9b61e" : "#292936" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                {band.image ? <img src={getImageUrl(band.image)} alt="" loading="lazy" style={{ width: "54px", height: "54px", objectFit: "cover", borderRadius: "8px" }} /> : <span aria-hidden="true" style={{ fontSize: "28px" }}>🎸</span>}
                <div style={{ minWidth: 0 }}><h3 style={{ margin: 0, fontSize: "16px" }}>{band.name}</h3><p style={{ margin: "4px 0 0", color: "#aaa", fontSize: "12px" }}>{Number(band.votes || 0)} voto(s)</p></div>
              </div>
              <button onClick={() => castVote(band)} disabled={saving === "vote" || Boolean(voteData.voted_band_id)} style={{ ...buttonStyle, opacity: voteData.voted_band_id ? 0.65 : 1 }}>{Number(band.id) === Number(voteData.voted_band_id) ? "Seu voto" : voteData.voted_band_id ? "Voto já registrado" : saving === "vote" ? "Registrando..." : "Votar nesta banda"}</button>
            </article>)}
            {(!voteData.bands || voteData.bands.length === 0) && <div style={panelStyle}>Ainda não há bandas disponíveis para votação.</div>}
          </div>
        </section>
        <section className="fan-area-section-card" style={{ marginBottom: "32px" }} aria-labelledby="notificacoes-fas-title">
          <h2 id="notificacoes-fas-title" style={{ margin: "0 0 8px", fontSize: "22px" }}>🔔 Suas notificações <span style={{ color: "#e9b61e" }}>({notifications.filter(item => !item.is_read).length} novas)</span></h2>
          <p style={{ color: "#aaa", lineHeight: 1.6, margin: "0 0 14px" }}>Avisos sobre suas bandas favoritas, shows salvos e a votação semanal.</p>
          {notifications.length === 0 ? <div style={panelStyle}>Quando uma notícia mencionar uma banda favorita, um show salvo estiver próximo ou uma nova votação começar, o aviso aparecerá aqui.</div> : (
            <div style={{ display: "grid", gap: "10px" }}>
              {notifications.map(item => {
                const link = safeNotificationLink(item.link);
                const linkLabel = item.type === "news" ? "Abrir notícia ↗" : item.type === "event" ? "Ver evento ↗" : "Participar ↗";
                return <article key={item.id} style={{ ...panelStyle, borderColor: item.is_read ? "#292936" : "#8d741b" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <div><h3 style={{ margin: "0 0 5px", fontSize: "16px" }}>{item.title}</h3><p style={{ color: "#aaa", margin: 0, lineHeight: 1.5 }}>{item.message}</p></div>
                    {!item.is_read && <button onClick={() => markNotificationRead(item)} style={{ ...buttonStyle, flexShrink: 0, fontSize: "12px" }}>Marcar lida</button>}
                  </div>
                  {link && (link.startsWith("/") ? <Link to={link} style={{ display: "inline-block", color: "#e9b61e", marginTop: "10px" }}>{linkLabel}</Link> : <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", color: "#e9b61e", marginTop: "10px" }}>{linkLabel}</a>)}
                </article>;
              })}
            </div>
          )}
        </section>
        <section className="fan-area-section-card" style={{ marginBottom: "32px" }} aria-labelledby="bate-papo-fas-title">
          <h2 id="bate-papo-fas-title" style={{ margin: "0 0 8px", fontSize: "22px" }}>💬 Conversa entre fãs</h2>
          <p style={{ color: "#aaa", lineHeight: 1.6, margin: "0 0 14px" }}>Compartilhe uma ideia, recomende uma banda e mantenha o respeito com a comunidade.</p>
          <form onSubmit={submitComment} style={{ ...panelStyle, marginBottom: "12px" }}>
            <label htmlFor="fan-comment" style={{ display: "block", marginBottom: "8px", color: "#ddd" }}>Seu comentário</label>
            <textarea id="fan-comment" value={commentText} onChange={e => setCommentText(e.target.value)} maxLength={1000} rows={3} placeholder="Qual banda você está ouvindo hoje?" style={{ boxSizing: "border-box", width: "100%", resize: "vertical", padding: "12px", borderRadius: "8px", border: "1px solid #333340", background: "#0a0a0e", color: "#fff", marginBottom: "10px" }} />
            <button type="submit" disabled={saving === "comment" || commentText.trim().length < 2} style={buttonStyle}>{saving === "comment" ? "Publicando..." : "Publicar comentário"}</button>
          </form>
          {comments.length === 0 ? <div style={panelStyle}>Ainda não há comentários. Seja o primeiro a puxar assunto!</div> : (
            <div style={{ display: "grid", gap: "10px" }}>
              {comments.slice(0, 30).map(item => <article key={item.id} style={panelStyle}>
                <p style={{ margin: "0 0 6px", fontWeight: 800 }}>{item.user_name || "Fã da Comunidade"}</p>
                <p style={{ margin: 0, color: "#ccc", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{item.content}</p>
                <p style={{ margin: "8px 0 0", color: "#777", fontSize: "12px" }}>{item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : ""}</p>
              </article>)}
            </div>
          )}
        </section>

        {error && <div role="alert" style={{ ...panelStyle, borderColor: "#a33", color: "#ffaaaa", marginBottom: "14px" }}>{error} {error.includes("Entre novamente") && <Link to="/login" style={{ color: "#e9b61e" }}>Fazer login</Link>} {error.includes("Tente novamente") && <button onClick={loadData} style={{ ...buttonStyle, marginLeft: "10px" }}>Tentar novamente</button>}</div>}
        {message && <div role="status" style={{ ...panelStyle, borderColor: "#4c8a56", color: "#b5f3bd", marginBottom: "14px" }}>{message}</div>}

        {loading ? <div style={{ padding: "36px 10px", color: "#aaa", textAlign: "center" }}>Carregando sua área...</div> : (
          <>
            <section className="fan-area-section-card" style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
                <h2 style={{ margin: 0, fontSize: "22px" }}>🎸 Bandas favoritas <span style={{ color: "#e9b61e" }}>({favorites.length})</span></h2>
                <Link to="/bandas" style={{ color: "#e9b61e", fontSize: "13px" }}>Explorar todas as bandas →</Link>
              </div>
              {favorites.length === 0 ? <div style={panelStyle}><p style={{ marginTop: 0, color: "#bbb" }}>Sua lista ainda está vazia. Encontre uma banda abaixo e toque em “Adicionar aos favoritos”.</p></div> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 235px), 1fr))", gap: "14px" }}>
                  {favorites.map(band => <article key={band.id} style={{ ...panelStyle, padding: 0, overflow: "hidden" }}>
                    {band.image && <img src={getImageUrl(band.image)} alt={band.name} loading="lazy" style={{ width: "100%", height: "145px", objectFit: "cover", display: "block" }} />}
                    <div style={{ padding: "14px" }}>
                      <h3 style={{ margin: "0 0 6px", fontSize: "18px" }}>{band.name}</h3>
                      <p style={{ color: "#aaa", fontSize: "13px", margin: "0 0 12px" }}>{band.genre || "Rock"}{band.city ? ` · ${band.city}` : ""}{band.state ? `/${band.state}` : ""}</p>
                      <div className="fan-area-actions">
                        <Link className="fan-area-action-btn" to={`/bandas/${band.id}`}>Ver banda</Link>
                        <button className="fan-area-action-btn fan-area-action-secondary" onClick={() => toggleFavorite(band)} disabled={saving === `band-${band.id}`}>{saving === `band-${band.id}` ? "Salvando..." : "Remover"}</button>
                      </div>
                    </div>
                  </article>)}
                </div>
              )}
            </section>

            <section className="fan-area-section-card" style={{ marginBottom: "32px" }}>
              <h2 style={{ margin: "0 0 14px", fontSize: "22px" }}>🔎 Descobrir bandas</h2>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por banda, gênero ou cidade..." aria-label="Buscar bandas" style={{ boxSizing: "border-box", width: "100%", maxWidth: "520px", marginBottom: "14px", padding: "12px 14px", borderRadius: "8px", border: "1px solid #333340", background: "#111118", color: "#fff" }} />
              {matchingBands.length === 0 ? <p style={{ color: "#aaa" }}>Nenhuma banda encontrada nessa busca.</p> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 235px), 1fr))", gap: "12px" }}>
                  {matchingBands.map(band => <article key={band.id} style={{ ...panelStyle, display: "flex", alignItems: "center", gap: "12px" }}>
                    {band.image ? <img src={getImageUrl(band.image)} alt="" loading="lazy" style={{ width: "66px", height: "66px", objectFit: "cover", borderRadius: "8px", flexShrink: 0 }} /> : <div aria-hidden="true" style={{ width: "66px", height: "66px", display: "grid", placeItems: "center", borderRadius: "8px", background: "#24242e", fontSize: "28px", flexShrink: 0 }}>🎸</div>}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>{band.name}</h3>
                      <p style={{ color: "#aaa", fontSize: "12px", margin: "0 0 10px" }}>{band.genre || "Rock"}{band.city ? ` · ${band.city}` : ""}</p>
                      <button className="fan-area-action-btn fan-area-favorite-add" onClick={() => toggleFavorite(band)} disabled={saving === `band-${band.id}`}>{saving === `band-${band.id}` ? "Salvando..." : "＋ Adicionar aos favoritos"}</button>
                    </div>
                  </article>)}
                </div>
              )}
            </section>

            <section className="fan-area-section-card" style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
                <h2 style={{ margin: 0, fontSize: "22px" }}>📅 Shows que quero assistir <span style={{ color: "#e9b61e" }}>({watchlist.length})</span></h2>
                <Link to="/eventos" style={{ color: "#e9b61e", fontSize: "13px" }}>Ver agenda completa →</Link>
              </div>
              {watchlist.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: "12px", marginBottom: "20px" }}>
                {watchlist.map(event => <article key={event.id} style={panelStyle}>
                  <p style={{ color: "#e9b61e", fontWeight: 800, fontSize: "12px", margin: "0 0 7px" }}>{formatDate(event.date)}{event.time ? ` · ${event.time}` : ""}</p>
                  <h3 style={{ margin: "0 0 7px", fontSize: "18px" }}>{event.title}</h3>
                  <p style={{ color: "#aaa", fontSize: "13px", margin: "0 0 12px" }}>{event.artist || "Line-up a confirmar"}{event.location ? ` · ${event.location}` : ""}{event.city ? ` · ${event.city}` : ""}</p>
                  <button onClick={() => toggleEvent(event)} disabled={saving === `event-${event.id}`} style={{ ...buttonStyle, background: "transparent", color: "#ddd", borderColor: "#454552" }}>{saving === `event-${event.id}` ? "Salvando..." : "Remover da lista"}</button>
                </article>)}
              </div>}
              <h3 style={{ color: "#ddd", fontSize: "16px", margin: "20px 0 12px" }}>Próximos eventos para salvar</h3>
              {events.filter(event => !event.date || new Date(`${event.date}T23:59:59`) >= new Date()).filter(event => !watchlistIds.has(Number(event.id))).slice(0, 12).length === 0 ? <p style={{ color: "#aaa" }}>Não há outros eventos publicados para adicionar agora.</p> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: "12px" }}>
                  {events.filter(event => !event.date || new Date(`${event.date}T23:59:59`) >= new Date()).filter(event => !watchlistIds.has(Number(event.id))).slice(0, 12).map(event => <article key={event.id} style={panelStyle}>
                    <p style={{ color: "#e9b61e", fontWeight: 800, fontSize: "12px", margin: "0 0 7px" }}>{formatDate(event.date)}{event.time ? ` · ${event.time}` : ""}</p>
                    <h3 style={{ margin: "0 0 7px", fontSize: "18px" }}>{event.title}</h3>
                    <p style={{ color: "#aaa", fontSize: "13px", margin: "0 0 12px" }}>{event.artist || "Line-up a confirmar"}{event.location ? ` · ${event.location}` : ""}{event.city ? ` · ${event.city}` : ""}</p>
                    <button onClick={() => toggleEvent(event)} disabled={saving === `event-${event.id}`} style={buttonStyle}>{saving === `event-${event.id}` ? "Salvando..." : "＋ Quero ir"}</button>
                  </article>)}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default AreaDoFa;
