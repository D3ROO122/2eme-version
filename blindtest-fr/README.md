# Blind Test FR 🎵

Devine les artistes et chansons français en quelques secondes.

## Features
- 🎵 Musiques via Deezer (previews 30s, aucune clé API requise)
- ⏱ 5 modes de durée : 1s / 3s / 5s / 10s / 30s
- 🎤 3 genres : Rap, R&B, Pop/Électro (ou tout mélangé)
- 💡 Système d'indices (premiers caractères de l'artiste ou du titre)
- ⏭ Bouton "Passer" pour les chansons inconnues
- ⚔️ Mode défi ami : joue et partage un lien pour que ton pote joue les mêmes musiques
- 📅 Défi du jour : même sélection pour tout le monde chaque jour
- 🔥 Streak et stats

## Déploiement sur Vercel

```bash
# 1. Installe Vercel CLI
npm i -g vercel

# 2. Dans ce dossier
vercel

# 3. Suis les instructions — c'est tout !
```

Ou via GitHub :
1. Push ce dossier sur un repo GitHub
2. Va sur [vercel.com](https://vercel.com) → New Project → importe le repo
3. Aucune variable d'environnement à configurer — déploie directement

## Structure
```
/
├── index.html        # Page principale
├── style.css         # Styles
├── game.js           # Logique du jeu
├── api/
│   └── deezer.js     # Proxy serverless (évite les erreurs CORS)
└── vercel.json       # Config Vercel
```

## Développement local

```bash
# Option 1 : Vercel CLI (recommandé, active le proxy)
npx vercel dev

# Option 2 : Serveur HTTP simple (sans proxy, appel direct Deezer)
npx serve .
# ou
python3 -m http.server 3000
```

> En local sans Vercel, le jeu fait un appel direct à `api.deezer.com`.
> En production sur Vercel, tout passe par `/api/deezer` pour éviter les problèmes CORS.

## Comment ça marche

1. Le jeu tire aléatoirement des requêtes parmi ~80 artistes français
2. Deezer renvoie des previews MP3 de 30s — gratuites, sans auth
3. Le jeu coupe l'extrait à la durée choisie (1s à 30s)
4. L'utilisateur tape l'artiste ou le titre (fautes de frappe tolérées via Levenshtein)
5. Mode défi : le seed aléatoire est encodé dans l'URL → les deux joueurs ont les mêmes musiques
