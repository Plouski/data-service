# Utiliser une image Node.js officielle comme base
FROM node:18-alpine

# Définir le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install --production

# Copier les fichiers du projet
COPY . .

# Exposer le port sur lequel le service va tourner
EXPOSE 5002

# Commande pour démarrer le service
CMD ["node", "index.js"]