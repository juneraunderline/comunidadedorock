import DOMPurify from "dompurify";

const EMBED_HOSTS = [
  "youtube.com", "youtube-nocookie.com", "youtu.be",
  "vimeo.com", "player.vimeo.com", "open.spotify.com",
  "w.soundcloud.com", "soundcloud.com", "bandcamp.com",
  "deezer.com", "widget.deezer.com", "music.apple.com",
  "embed.music.apple.com", "dailymotion.com", "dai.ly",
  "tiktok.com", "instagram.com", "facebook.com",
  "player.twitch.tv", "streamable.com"
];

function isAllowedEmbedUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return EMBED_HOSTS.some((domain) => host === domain || host.endsWith("." + domain));
  } catch {
    return false;
  }
}

export function sanitizeRichContent(html = "") {
  if (!html) return "";
  const fragment = DOMPurify.sanitize(String(html), {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["src", "title", "allow", "allowfullscreen", "frameborder", "referrerpolicy", "width", "height", "loading"],
    FORBID_TAGS: ["object", "embed", "form"],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true
  });
  const container = document.createElement("div");
  container.appendChild(fragment);

  container.querySelectorAll("iframe").forEach((iframe) => {
    const src = iframe.getAttribute("src") || "";
    if (!isAllowedEmbedUrl(src)) {
      iframe.remove();
      return;
    }
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("title", iframe.getAttribute("title") || "Player incorporado");
    iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    iframe.removeAttribute("width");
    iframe.removeAttribute("height");
    if (!iframe.parentElement?.classList.contains("video-embed")) {
      const wrapper = document.createElement("div");
      wrapper.className = "video-embed";
      iframe.parentNode.insertBefore(wrapper, iframe);
      wrapper.appendChild(iframe);
    }
  });

  return container.innerHTML;
}

export function buildEmbedHtml(input = "") {
  const value = String(input || "").trim();
  if (!value) throw new Error("Cole o link do vídeo ou o código de incorporação.");

  if (/<iframe\b/i.test(value)) {
    const safeHtml = sanitizeRichContent(value);
    if (!/<iframe\b/i.test(safeHtml)) {
      throw new Error("Esse código não usa um provedor de vídeo permitido. Use YouTube, Vimeo, Spotify, SoundCloud, Bandcamp ou outro serviço compatível.");
    }
    return safeHtml;
  }

  let url;
  try {
    url = new URL(value);
    if (url.protocol !== "https:") throw new Error("URL insegura");
  } catch {
    throw new Error("Informe um link HTTPS válido ou cole o código iframe fornecido pela plataforma.");
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let src = "";

  if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com")) {
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    else if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
    else id = url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] || "";
    if (!/^[\w-]{6,}$/.test(id)) throw new Error("Não consegui identificar o vídeo do YouTube nesse link.");
    src = "https://www.youtube-nocookie.com/embed/" + id;
  } else if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
    if (!id) throw new Error("Não consegui identificar o vídeo do Vimeo nesse link.");
    src = "https://player.vimeo.com/video/" + id;
  } else if (host === "open.spotify.com") {
    const path = url.pathname.replace(/^\/embed\//, "").replace(/^\/+/, "");
    if (!/^(?:track|album|playlist|episode|show)\/[\w]+/.test(path)) throw new Error("Use um link de faixa, álbum, playlist ou podcast do Spotify.");
    src = "https://open.spotify.com/embed/" + path;
  } else if (host === "soundcloud.com") {
    src = "https://w.soundcloud.com/player/?url=" + encodeURIComponent(url.href) + "&color=%23e9b51d";
  } else if (host === "deezer.com") {
    const match = url.pathname.match(/\/(track|album|playlist|episode)\/(\d+)/);
    if (!match) throw new Error("Não consegui identificar a música ou playlist do Deezer.");
    src = "https://widget.deezer.com/widget/dark/" + match[1] + "/" + match[2];
  } else if (host === "dailymotion.com" || host === "dai.ly") {
    const id = host === "dai.ly" ? url.pathname.slice(1) : url.pathname.match(/\/video\/([^_/?]+)/)?.[1];
    if (!id) throw new Error("Não consegui identificar o vídeo do Dailymotion.");
    src = "https://www.dailymotion.com/embed/video/" + id;
  } else if (host.endsWith("tiktok.com")) {
    const id = url.pathname.match(/\/video\/(\d+)/)?.[1];
    if (!id) throw new Error("Não consegui identificar o vídeo do TikTok. Se possível, cole o código iframe oficial.");
    src = "https://www.tiktok.com/embed/v2/" + id;
  } else if (isAllowedEmbedUrl(url.href)) {
    src = url.href;
  } else {
    throw new Error("Plataforma ainda não compatível. Cole o código iframe oficial de um provedor suportado.");
  }

  return sanitizeRichContent('<div class="video-embed"><iframe src="' + src + '" title="Player incorporado" allowfullscreen></iframe></div>');
}
