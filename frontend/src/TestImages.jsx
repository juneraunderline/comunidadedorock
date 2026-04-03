import { useEffect, useState } from "react";
import axios from "axios";
import API_URL from "./config/api";

export default function TestImages() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_URL}/api/posts`)
      .then((res) => {
        console.log("✅ Posts carregados:", res.data.length);
        setPosts(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ Erro:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ color: "#fff", padding: "40px" }}>Carregando...</div>;

  return (
    <div style={{ background: "#000", color: "#fff", padding: "40px" }}>
      <h1>🖼️ Teste de Imagens - React Simples</h1>
      <p>Total de posts: {posts.length}</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px",
          marginTop: "30px",
        }}
      >
        {posts.slice(0, 6).map((post) => (
          <div
            key={post.id}
            style={{
              border: "1px solid #e91e63",
              overflow: "hidden",
              background: "#111",
            }}
          >
            <img
              src={post.image}
              alt={post.title}
              style={{
                width: "100%",
                height: "250px",
                objectFit: "cover",
                display: "block",
                background: "#222",
              }}
              onLoad={() => console.log("✅ [React] Imagem carregou:", post.image)}
              onError={() => console.log("❌ [React] Erro ao carregar:", post.image)}
            />
            <div style={{ padding: "15px" }}>
              <h3 style={{ fontSize: "14px", color: "#e91e63", margin: "5px 0" }}>
                {post.title.substring(0, 35)}...
              </h3>
              <p style={{ fontSize: "12px", color: "#999" }}>
                Fonte: {post.source}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
