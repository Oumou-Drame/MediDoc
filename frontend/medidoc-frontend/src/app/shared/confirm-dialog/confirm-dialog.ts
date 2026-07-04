import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
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

  @Output() confirmer = new EventEmitter<void>();
  @Output() annulerAction = new EventEmitter<void>();

  surFond() {
    this.annulerAction.emit();
  }
}
