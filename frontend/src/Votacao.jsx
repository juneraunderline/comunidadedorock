import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

const panel = { background: "#111118", border: "1px solid #292936", borderRadius: "12px", padding: "18px" };
const button = { border: "1px solid #e9b61e", borderRadius: "7px", background: "#e9b61e", color: "#101014", padding: "10px 14px", fontWeight: 800, cursor: "pointer" };
const PENDING_VOTE_KEY = "cdr_pending_vote_band_id";

function Votacao({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState({ bands: [], week_start: null });
  const [myVote, setMyVote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [suggestedBandName, setSuggestedBandName] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  const headers = useCallback(() => {
    const token = localStorage.getItem("cdr_session_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await axios.get(`${API_URL}/api/votacao`, { timeout: 20000 });
      setData(response.data || { bands: [], week_start: null });
      if (user && localStorage.getItem("cdr_session_token")) {
        try {
          const personal = await axios.get(`${API_URL}/api/fan/vote`, { headers: headers(), timeout: 15000 });
          setMyVote(personal.data?.voted_band_id || null);
        } catch { setMyVote(null); }
      } else setMyVote(null);
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível carregar a votação agora. Tente novamente.");
    } finally { setLoading(false); }
  }, [headers, user]);

  useEffect(() => { load(); }, [load]);

  // Se a pessoa escolheu uma banda antes de entrar, registra o voto após o login.
  useEffect(() => {
    if (loading || !user || !localStorage.getItem("cdr_session_token")) return;
    const pendingId = Number(localStorage.getItem(PENDING_VOTE_KEY));
    if (!pendingId || !data.bands?.some((band) => Number(band.id) === pendingId)) return;

    // O servidor é a fonte da verdade: não tenta votar de novo se já existe voto semanal.
    if (myVote) {
      localStorage.removeItem(PENDING_VOTE_KEY);
      setMessage("Seu voto desta semana já estava registrado. Obrigado por apoiar a cena independente!");
      return;
    }

    // Remove antes da chamada para evitar envios duplicados em re-renderizações.
    localStorage.removeItem(PENDING_VOTE_KEY);
    const selectedBand = data.bands.find((band) => Number(band.id) === pendingId);
    let active = true;
    setSaving(true);
    setError("");
    axios.post(`${API_URL}/api/fan/vote`, { band_id: pendingId }, { headers: headers(), timeout: 15000 })
      .then(() => {
        if (!active) return;
        setMyVote(pendingId);
        setData((current) => ({
          ...current,
          bands: current.bands.map((band) => ({
            ...band,
            votes: Number(band.votes || 0) + (Number(band.id) === pendingId ? 1 : 0)
          }))
        }));
        setMessage(`Seu voto em ${selectedBand.name} foi registrado. Obrigado por fortalecer o rock independente!`);
      })
      .catch((err) => {
        if (!active) return;
        if (err.response?.status === 409) {
          setError("Seu voto desta semana já foi registrado. A votação reabre na segunda-feira.");
          load();
        } else {
          setError(err.response?.data?.error || "Não foi possível registrar seu voto. Escolha a banda novamente para tentar.");
        }
      })
      .finally(() => { if (active) setSaving(false); });
    return () => { active = false; };
  }, [data.bands, headers, load, loading, myVote, user]);

  const vote = async (band) => {
    if (!user || !localStorage.getItem("cdr_session_token")) {
      localStorage.setItem(PENDING_VOTE_KEY, String(band.id));
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      await axios.post(`${API_URL}/api/fan/vote`, { band_id: Number(band.id) }, { headers: headers(), timeout: 15000 });
      setMyVote(Number(band.id));
      setData(current => ({ ...current, bands: current.bands.map(item => ({ ...item, votes: Number(item.votes || 0) + (Number(item.id) === Number(band.id) ? 1 : 0) })) }));
      setMessage(`Seu voto em ${band.name} foi registrado. Obrigado por fortalecer o rock independente!`);
    } catch (err) {
      if (err.response?.status === 409) {
        setError("Seu voto desta semana já foi registrado. A votação reabre na segunda-feira.");
        load();
      } else setError(err.response?.data?.error || "Não foi possível registrar seu voto.");
    } finally { setSaving(false); }
  };

  const weekStartValue = data.week_start == null ? "" : String(data.week_start).slice(0, 10);
  const weekStartDate = /^\d{4}-\d{2}-\d{2}$/.test(weekStartValue) ? new Date(`${weekStartValue}T00:00:00`) : null;
  const weekLabel = weekStartDate && !Number.isNaN(weekStartDate.getTime())
    ? weekStartDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  return <main style={{ minHeight: "70vh", background: "#0a0a0e", color: "#f5f5f7", padding: "36px 18px 60px" }}>
    <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
      <p style={{ color: "#e9b61e", fontWeight: 800, letterSpacing: "2px", fontSize: "12px" }}>A CENA É QUEM ESCOLHE</p>
      <h1 style={{ margin: "8px 0", color: "#fff", fontSize: "clamp(28px, 5vw, 42px)" }}>🏆 VOTAÇÃO DA <span style={{ color: "#e9b61e" }}>BANDA DA SEMANA</span></h1>
      <p style={{ color: "#b5b5c1", lineHeight: 1.7, maxWidth: "760px" }}>Esta página é pública: todo mundo pode conhecer as bandas concorrentes e acompanhar os resultados. Para votar, escolha uma banda e entre ou crie uma conta grátis; seu voto será enviado depois do login. Cada conta pode votar uma vez por semana; a votação reabre na segunda-feira.</p>
      {weekLabel && <p style={{ color: "#888", fontSize: "13px" }}>Semana iniciada em {weekLabel}</p>}
      {error && <div role="alert" style={{ ...panel, borderColor: "#8d3434", color: "#ffb7b7", margin: "16px 0" }}>{error}</div>}
      {(message || myVote) && <div role="status" style={{ ...panel, borderColor: "#6d5717", color: "#f5d978", margin: "16px 0" }}>{message || "Seu voto desta semana já foi registrado. Valeu por participar e apoiar a cena independente!"}</div>}
      {loading ? <div style={panel}>Carregando bandas e resultados…</div> : <div className="votacao-layout" style={{ display: "grid", gridTemplateColumns: "250px minmax(0, 1fr)", gap: "18px", alignItems: "start", marginTop: "24px" }}>
        <aside style={{ ...panel, padding: "14px", textAlign: "left" }} aria-label="Sugira uma banda para votação">
          <h2 style={{ margin: "0 0 8px", fontSize: "17px", color: "#fff" }}>🎸 SUGIRA UMA BANDA</h2>
          <p style={{ color: "#b7b7c3", fontSize: "12px", lineHeight: 1.6, margin: "0 0 12px" }}>Digite o nome da sua favorita. Envie uma banda por vez; ela entra na lista de candidatas à Banda da Semana.</p>

          <h3 style={{ margin: "0 0 10px", fontSize: "14px", color: "#e9b61e" }}>BANDAS SUGERIDAS PELOS FÃS</h3>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "7px" }}>
            {[...data.bands].filter((band) => band.candidate_type === "suggestion").sort((x, y) => Number(y.votes || 0) - Number(x.votes || 0) || String(x.name || "").localeCompare(String(y.name || ""), "pt-BR")).map((band, rank) => <li key={band.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 8px", borderRadius: "7px", background: "#17171f", border: "1px solid #292936", color: "#f5f5f7" }}>
              <span style={{ minWidth: "20px", fontSize: "12px", color: "#9696a4", fontWeight: 800 }}>{String(rank + 1).padStart(2, "0")}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: "13px", fontWeight: 650, overflowWrap: "anywhere" }}>{band.name}</span>
              <span style={{ fontSize: "12px", whiteSpace: "nowrap", color: "#aaa" }}>{Number(band.votes || 0)} voto(s)</span>
            </li>)}
          </ol>
          {!data.bands.some((band) => band.candidate_type === "suggestion") && <p style={{ color: "#9292a0", fontSize: "12px", marginBottom: 0 }}>Ainda não há sugestões. Seja o primeiro!</p>}
          <form onSubmit={async (event) => {
            event.preventDefault();
            const name = suggestedBandName.trim();
            if (!name || suggesting) return;
            setSuggesting(true); setError(""); setMessage("");
            try {
              const response = await axios.post(API_URL + "/api/votacao/sugerir", { name }, { timeout: 15000 });
              setData((current) => ({ ...current, bands: [...(current.bands || []), response.data.candidate] }));
              setSuggestedBandName("");
              setMessage(response.data?.message || "Banda adicionada à lista de votação!");
            } catch (err) {
              setError(err.response?.data?.error || "Não foi possível sugerir essa banda agora.");
            } finally { setSuggesting(false); }
          }} style={{ display: "grid", gap: "8px", marginBottom: "18px" }}>
            <label htmlFor="votacao-suggest-band" style={{ fontSize: "12px", color: "#ddd" }}>Nome da banda</label>
            <input id="votacao-suggest-band" value={suggestedBandName} onChange={(event) => setSuggestedBandName(event.target.value)} maxLength={80} minLength={2} required placeholder="Ex.: nome da banda" style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "7px", border: "1px solid #383846", background: "#09090e", color: "#fff" }} />
            <button type="submit" disabled={suggesting || !suggestedBandName.trim()} style={{ ...button, opacity: suggesting || !suggestedBandName.trim() ? 0.65 : 1 }}>{suggesting ? "ADICIONANDO…" : "ADICIONAR À VOTAÇÃO"}</button>
          </form>
        </aside>
        <div className="votacao-bandas-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px", minWidth: 0 }}>
        {!data.bands.length && <p style={{ ...panel, gridColumn: "1 / -1", color: "#b7b7c3" }}>Ainda não há candidatas. Sugira a primeira banda no formulário ao lado.</p>}
        {data.bands.map((band, index) => <article key={band.candidate_type === "suggestion" ? "suggestion-" + Math.abs(Number(band.id)) : "band-" + band.id} style={{ ...panel, padding: "14px", minWidth: 0, boxSizing: "border-box", borderColor: myVote && Number(myVote) === Number(band.id) ? "#e9b61e" : "#292936", display: "flex", flexDirection: "column", gap: "12px" }}>
          {band.image ? <img src={getImageUrl(band.image)} alt={`Imagem da banda ${band.name}`} loading="lazy" style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "8px", background: "#08080c" }} /> : <div aria-hidden="true" style={{ height: "180px", borderRadius: "8px", background: "#1b1b24", display: "grid", placeItems: "center", fontSize: "52px" }}>🎸</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "10px" }}>
            <h2 style={{ margin: 0, fontSize: "19px" }}>{band.name}</h2>
            {index === 0 && Number(band.votes || 0) > 0 && <span style={{ color: "#e9b61e", fontSize: "12px", fontWeight: 800 }}>LÍDER</span>}
          </div>
          {band.candidate_type === "suggestion" && <p style={{ color: "#9292a0", fontSize: "12px", margin: 0 }}>Sugerida por um fã</p>}
          <p style={{ color: "#b7b7c3", margin: 0 }}>{Number(band.votes || 0)} voto(s) nesta semana</p>
          <div style={{ height: "6px", borderRadius: "99px", background: "#292936", overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, data.bands.reduce((max, item) => Math.max(max, Number(item.votes || 0)), 0) ? Number(band.votes || 0) / Math.max(...data.bands.map(item => Number(item.votes || 0))) * 100 : 0))}%`, height: "100%", background: "#e9b61e" }} /></div>
          <button onClick={() => vote(band)} disabled={saving || Boolean(myVote)} style={{ ...button, opacity: saving || myVote ? 0.65 : 1, marginTop: "auto" }}>{Number(myVote) === Number(band.id) ? "SEU VOTO" : myVote ? "VOTO JÁ REGISTRADO" : saving ? "REGISTRANDO…" : user ? "VOTAR NESTA BANDA" : "ENTRAR PARA VOTAR"}</button>
        </article>)}
        </div>
      </div> : <div style={{ ...panel, marginTop: "24px" }}>Ainda não há bandas disponíveis para votação. Volte em breve!</div>}
      <p style={{ color: "#888", fontSize: "12px", lineHeight: 1.6, marginTop: "24px" }}>A votação é limitada no servidor a um voto por conta por semana. A contagem exibida representa os votos registrados na semana atual.</p>
    </div>
  </main>;
}

export default Votacao;
