import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog {
  @Input() visible = false;
  @Input() titre = 'Confirmer';
  @Input() message = '';
  @Input() texteConfirmer = 'Confirmer';
  @Input() texteAnnuler = 'Annuler';
  @Input() danger = true;
  @Input() enCours = false;

  // Champ texte optionnel (ex: motif de refus) — non affiché si avecChamp = false
  @Input() avecChamp = false;
  @Input() labelChamp = '';
  @Input() champValeur = '';
  @Output() champValeurChange = new EventEmitter<string>();

  @Output() confirmer = new EventEmitter<void>();
  @Output() annulerAction = new EventEmitter<void>();

  surFond() {
    this.annulerAction.emit();
  }

  surChangementChamp(valeur: string) {
    this.champValeur = valeur;
    this.champValeurChange.emit(valeur);
  }
}
