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
          <h1 style={{ margin: 0, fontSize: "clamp(28px, 5vw, 42px)" }}>MINHA <span style={{ color: "#e9b61e" }}>ÁREA</span></h1>
          <p style={{ color: "#a6a6b3", lineHeight: 1.6, maxWidth: "700px" }}>Guarde as bandas que você curte e monte sua lista de shows para acompanhar. Tudo fica vinculado à sua conta.</p>
        </div>

        <section style={{ marginBottom: "32px" }} aria-labelledby="feed-personalizado-title">
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

        {error && <div role="alert" style={{ ...panelStyle, borderColor: "#a33", color: "#ffaaaa", marginBottom: "14px" }}>{error} {error.includes("Entre novamente") && <Link to="/login" style={{ color: "#e9b61e" }}>Fazer login</Link>} {error.includes("Tente novamente") && <button onClick={loadData} style={{ ...buttonStyle, marginLeft: "10px" }}>Tentar novamente</button>}</div>}
        {message && <div role="status" style={{ ...panelStyle, borderColor: "#4c8a56", color: "#b5f3bd", marginBottom: "14px" }}>{message}</div>}

        {loading ? <div style={{ padding: "36px 10px", color: "#aaa", textAlign: "center" }}>Carregando sua área...</div> : (
          <>
            <section style={{ marginBottom: "32px" }}>
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
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <Link to={`/bandas/${band.id}`} style={{ ...buttonStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Ver banda</Link>
                        <button onClick={() => toggleFavorite(band)} disabled={saving === `band-${band.id}`} style={{ ...buttonStyle, background: "transparent", color: "#ddd", borderColor: "#454552" }}>{saving === `band-${band.id}` ? "Salvando..." : "Remover"}</button>
                      </div>
                    </div>
                  </article>)}
                </div>
              )}
            </section>

            <section style={{ marginBottom: "32px" }}>
              <h2 style={{ margin: "0 0 14px", fontSize: "22px" }}>🔎 Descobrir bandas</h2>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por banda, gênero ou cidade..." aria-label="Buscar bandas" style={{ boxSizing: "border-box", width: "100%", maxWidth: "520px", marginBottom: "14px", padding: "12px 14px", borderRadius: "8px", border: "1px solid #333340", background: "#111118", color: "#fff" }} />
              {matchingBands.length === 0 ? <p style={{ color: "#aaa" }}>Nenhuma banda encontrada nessa busca.</p> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 235px), 1fr))", gap: "12px" }}>
                  {matchingBands.map(band => <article key={band.id} style={{ ...panelStyle, display: "flex", alignItems: "center", gap: "12px" }}>
                    {band.image ? <img src={getImageUrl(band.image)} alt="" loading="lazy" style={{ width: "66px", height: "66px", objectFit: "cover", borderRadius: "8px", flexShrink: 0 }} /> : <div aria-hidden="true" style={{ width: "66px", height: "66px", display: "grid", placeItems: "center", borderRadius: "8px", background: "#24242e", fontSize: "28px", flexShrink: 0 }}>🎸</div>}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>{band.name}</h3>
                      <p style={{ color: "#aaa", fontSize: "12px", margin: "0 0 10px" }}>{band.genre || "Rock"}{band.city ? ` · ${band.city}` : ""}</p>
                      <button onClick={() => toggleFavorite(band)} disabled={saving === `band-${band.id}`} style={buttonStyle}>{saving === `band-${band.id}` ? "Salvando..." : "＋ Adicionar aos favoritos"}</button>
                    </div>
                  </article>)}
                </div>
              )}
            </section>

            <section>
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
