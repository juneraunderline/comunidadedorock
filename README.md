# 🎸 Rock Independente

> O melhor do rock underground brasileiro em um só lugar

Plataforma web com notícias, bandas, entrevistas e eventos da cena de rock independente brasileira.

## 🚀 Quick Start (Desenvolvimento Local)

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Instalação

```bash
# Backend
cd backend
npm install
npm start
# Backend rodará em http://localhost:3000

# Frontend (novo terminal)
cd frontend
npm install
npm run dev
# Frontend rodará em http://localhost:5173
```

### Login Admin
```
Email: admin
Senha: 1234
```

## 📁 Estrutura

```
rock/
├── backend/          # Express.js + SQLite
│   ├── server.js
│   ├── package.json
│   └── database.db
└── frontend/         # React + Vite
    ├── src/
    ├── package.json
    └── vite.config.js
```

## 🎯 Features

- ✅ Gerenciar notícias (RSS Feeds)
- ✅ Cadastro de bandas
- ✅ Entrevistas com artistas
- ✅ Eventos com ingressos
- ✅ Admin Dashboard
- ✅ Imagens locais/externas

## 📖 Documentação Completa

Veja [DEPLOY.md](./DEPLOY.md) para instruções de deploy em produção com Railway/Vercel.

## 🛠️ Stack Tecnológico

**Frontend:**
- React 19
- Vite
- React Router
- Axios
- CSS3

**Backend:**
- Node.js
- Express.js
- SQLite3
- CORS

## 📝 API Endpoints

### Notícias
- `GET /api/posts` - Listar notícias
- `POST /api/posts` - Criar notícia (admin)
- `PUT /api/posts/:id` - Editar notícia
- `DELETE /api/posts/:id` - Deletar notícia

### Bandas
- `GET /api/bands` - Listar bandas aprovadas
- `POST /api/bands` - Criar banda (admin)
- `POST /api/bands/submit` - Submeter banda para aprovação

### Eventos
- `GET /api/events` - Listar eventos
- `POST /api/events` - Criar evento (admin)
- `PUT /api/events/:id` - Editar evento
- `DELETE /api/events/:id` - Deletar evento

### Entrevistas
- `GET /api/interviews` - Listar entrevistas
- `POST /api/interviews` - Criar entrevista (admin)

## 🚀 Deploy

Veja instruções completas em [DEPLOY.md](./DEPLOY.md)

**Opções recomendadas:**
1. Railway (tudo integrado) - $5-10/mês
2. Vercel (frontend) + Railway (backend)

## 📄 Licença

Projeto de demonstração - Comunidade do Rock

## 🙋 Suporte

Para dúvidas sobre deploy:
1. Leia [DEPLOY.md](./DEPLOY.md)
2. Verifique [Railway Docs](https://docs.railway.app)
3. Verifique [Vercel Docs](https://vercel.com/docs)

---

**Desfrute! 🎵**
