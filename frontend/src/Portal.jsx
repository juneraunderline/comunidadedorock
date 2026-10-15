import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_URL from "./config/api";
import "./portal.css";

function Portal() {
  const [feeds, setFeeds] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem("cdr_rss_feeds_v1") || "[]");
      return Array.isArray(cached) ? cached : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(() => {
    try { return !Array.isArray(JSON.parse(localStorage.getItem("cdr_rss_feeds_v1") || "null")); }
    catch { return true; }
  });
  const [unavailable, setUnavailable] = useState(false);

  // Função para obter favicon do site
  const getFaviconUrl = (feedUrl) => {
    try {
      const url = new URL(feedUrl);
      const domain = url.origin;
      // Tenta favicon.ico primeiro, depois a API do Google
      return `${domain}/favicon.ico`;
    } catch {
      return null;
    }
  };

  const loadFeeds = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/rss-feeds`, { timeout: 12000 });
      if (!Array.isArray(response.data)) throw new Error("Resposta inválida ao carregar portais");
      setFeeds(response.data);
      setUnavailable(false);
      try { localStorage.setItem("cdr_rss_feeds_v1", JSON.stringify(response.data)); } catch {}
      return true;
    } catch (error) {
      console.error("Erro ao carregar portais:", error);
      setUnavailable(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let retryTimer;
    const refresh = async () => {
      if (!active || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        let loaded = await loadFeeds();
        for (let attempt = 0; active && !loaded && attempt < 3; attempt += 1) {
          await new Promise(resolve => {
            retryTimer = setTimeout(resolve, 1500 * (attempt + 1));
          });
          if (!active) return;
          loaded = await loadFeeds();
        }
      } finally {
        inFlight = false;
      }
    };
    const onVisible = () => { if (document.visibilityState !== "hidden") refresh(); };
    refresh();
    const interval = setInterval(refresh, 60000);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(interval);
      clearTimeout(retryTimer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadFeeds]);
