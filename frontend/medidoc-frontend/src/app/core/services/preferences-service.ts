import { Injectable } from '@angular/core';

export type TaillePolice = 'petite' | 'moyenne' | 'grande';

const STORAGE_KEY = 'medidoc_taille_police';

// Taille de la police racine par préférence — tout le reste de l'appli est en rem,
// donc ça fait varier proportionnellement l'ensemble des textes, espacements typographiques, etc.
const TAILLES: Record<TaillePolice, string> = {
  petite: '14px',
  moyenne: '16px',
  grande: '18px',
};

@Injectable({
  providedIn: 'root',
})
export class PreferencesService {

  get tailleActuelle(): TaillePolice {
    const sauvegarde = localStorage.getItem(STORAGE_KEY) as TaillePolice | null;
    return sauvegarde && TAILLES[sauvegarde] ? sauvegarde : 'moyenne';
  }

  // À appeler une fois au démarrage de l'app pour appliquer la préférence sauvegardée.
  appliquerPreferenceSauvegardee(): void {
    this.appliquer(this.tailleActuelle);
  }

  definirTaille(taille: TaillePolice): void {
    localStorage.setItem(STORAGE_KEY, taille);
    this.appliquer(taille);
  }

  private appliquer(taille: TaillePolice): void {
    document.documentElement.style.fontSize = TAILLES[taille];
  }
}
