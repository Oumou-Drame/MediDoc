import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PreferencesService } from './core/services/preferences-service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('medidoc-frontend');

  constructor() {
    inject(PreferencesService).appliquerPreferenceSauvegardee();
  }
}
