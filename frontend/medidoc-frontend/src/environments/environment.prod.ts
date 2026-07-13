// Environnement de production. URLs relatives : le frontend et l'API sont servis
// sous le même nom de domaine (Nginx fait le reverse proxy de /api vers le backend),
// donc pas besoin d'indiquer un domaine en dur ici et aucun souci de CORS.
export const environment = {
  production: true,
  apiOrigin: '',
  apiUrl: '/api'
};
