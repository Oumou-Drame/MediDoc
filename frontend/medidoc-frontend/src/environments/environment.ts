// Environnement de développement (ng serve / npm start).
// apiOrigin = origine seule (pour construire des URLs de fichiers/téléchargement).
// apiUrl = base des appels API (chaque service ajoute son segment, ex: `${environment.apiUrl}/auth`).
export const environment = {
  production: false,
  apiOrigin: 'http://localhost:5000',
  apiUrl: 'http://localhost:5000/api'
};
