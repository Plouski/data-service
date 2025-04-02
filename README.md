# Database Service - RoadTrip App

## 🗂️ Description
Microservice de gestion des données pour l'application RoadTrip. Responsable de toutes les opérations de base de données, including user management, subscriptions, trips, and AI interactions.

## 🚀 Fonctionnalités Principales
- Gestion complète des utilisateurs
- Gestion des abonnements
- Stockage et récupération des trips
- Sauvegarde de l'historique des interactions IA
- Sécurisation des accès et des données

## 🛠️ Technologies Utilisées
- Node.js
- Express.js
- MongoDB
- Mongoose
- JSON Web Token (JWT)
- Winston (Logging)

## 📦 Structure du Projet
```
/database-service
├── models/           # Schémas de données Mongoose
├── routes/           # Définition des endpoints
├── controllers/      # Logique métier
├── services/         # Opérations de base de données
├── middlewares/      # Authentification et validation
├── utils/            # Outils utilitaires
└── config/           # Configuration de l'application
```

## 🔐 Sécurité
- Authentification JWT
- Validation et nettoyage des entrées
- Protection contre les injections NoSQL
- Logs de sécurité détaillés

## 🚀 Installation

### Prérequis
- Node.js (v18+)
- MongoDB (v5+)

### Étapes d'installation
1. Cloner le dépôt
```bash
git clone https://github.com/votre-organisation/roadtrip-database-service.git
cd roadtrip-database-service
```

2. Installer les dépendances
```bash
npm install
```

3. Configurer les variables d'environnement
Créer un fichier `.env` avec les variables suivantes :
```
PORT=5002
MONGO_URI=mongodb://localhost:27017/roadtrip-app
JWT_SECRET=votre_secret_jwt
LOG_LEVEL=info
```

4. Démarrer le service
```bash
# Mode développement
npm run dev

# Mode production
npm start
```

## 🧪 Tests
```bash
npm test
```

## 📋 API Endpoints

### Utilisateurs
- `POST /api/users/register` - Créer un nouvel utilisateur
- `GET /api/users/profile` - Récupérer le profil utilisateur
- `PUT /api/users/profile` - Mettre à jour le profil
- `DELETE /api/users/account` - Supprimer le compte

### Trips
- `POST /api/trips` - Créer un nouveau trip
- `GET /api/trips` - Lister les trips
- `GET /api/trips/:id` - Détails d'un trip
- `PUT /api/trips/:id` - Mettre à jour un trip
- `DELETE /api/trips/:id` - Supprimer un trip

## 🔒 Authentification
Toutes les routes protégées nécessitent un token JWT valide dans l'en-tête :
```
Authorization: Bearer <token>
```

## 🐳 Conteneurisation
Un Dockerfile est fourni pour le déploiement containerisé.

```bash
# Construire l'image
docker build -t roadtrip-database-service .

# Exécuter le conteneur
docker run -p 5002:5002 roadtrip-database-service
```

## 🚨 Gestion des Erreurs
- Logs détaillés dans `/logs`
- Gestion centralisée des erreurs
- Réponses d'erreur structurées

## 📝 Licence
[Préciser la licence - MIT, Apache, etc.]

## 👥 Contribution
1. Forker le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Committer les modifications (`git commit -m 'Add some AmazingFeature'`)
4. Pousser la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📞 Contact
Votre Nom - votre.email@example.com

Lien du Projet : [https://github.com/votre-organisation/roadtrip-database-service](https://github.com/votre-organisation/roadtrip-database-service)