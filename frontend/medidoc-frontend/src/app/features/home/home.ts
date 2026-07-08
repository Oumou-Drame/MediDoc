import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RegistrationService } from '../../core/services/registration-service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit, OnDestroy {
  private registrationService = inject(RegistrationService);

  scrolled = false;
  activeStep = 0;
  private stepInterval: any;

  particles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];

  steps = [
    { icon: '🔬', title: 'Analyse effectuée', desc: 'Le technicien saisit les résultats dans MediDoc et génère un document PDF sécurisé prêt à être envoyé.' },
    { icon: '🔐', title: 'Chiffrement & envoi', desc: 'Le résultat est chiffré avec un code PIN unique et un lien sécurisé est envoyé au patient par WhatsApp ou email.' },
    { icon: '📱', title: 'Accès patient', desc: 'Le patient clique sur le lien reçu, entre son code PIN et consulte ses résultats en toute sécurité depuis n\'importe quel appareil.' },
    { icon: '✅', title: 'Traçabilité complète', desc: 'Chaque accès est enregistré avec horodatage. L\'administrateur suit tout en temps réel depuis le tableau de bord.' }
  ];

  features = [
    { icon: '🛡️', title: 'Sécurité maximale', desc: 'Chiffrement de bout en bout, codes PIN uniques, liens à durée limitée de 48h.' },
    { icon: '⚡', title: 'Envoi instantané', desc: 'Résultats transmis en quelques secondes via WhatsApp ou email.' },
    { icon: '📊', title: 'Tableau de bord', desc: 'Suivi en temps réel des envois, consultations et statistiques détaillées.' },
    { icon: '👥', title: 'Multi-utilisateurs', desc: 'Gestion des techniciens, rôles et permissions depuis un seul endroit.' },
    { icon: '📱', title: 'Responsive', desc: 'Interface optimisée pour tous les appareils, mobile et desktop.' },
    { icon: '🔍', title: 'Historique complet', desc: 'Archivage et recherche de tous les résultats envoyés avec filtres avancés.' }
  ];

  mockRows = [
    { name: 'Ahmed B.', status: 'Consulté', color: 'green', time: 'il y a 2 min' },
    { name: 'Sara M.', status: 'Envoyé', color: 'teal', time: 'il y a 15 min' },
    { name: 'Karim L.', status: 'En attente', color: 'amber', time: 'il y a 1h' },
    { name: 'Nadia R.', status: 'Consulté', color: 'green', time: 'il y a 3h' }
  ];

  ngOnInit() {
    this.stepInterval = setInterval(() => {
      this.activeStep = (this.activeStep + 1) % this.steps.length;
    }, 3200);
  }

  ngOnDestroy() {
    clearInterval(this.stepInterval);
  }

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled = window.scrollY > 60;
  }

  setStep(i: number) {
    this.activeStep = i;
  }

  getCurrentYear(): number {
    return new Date().getFullYear();
  }

}
