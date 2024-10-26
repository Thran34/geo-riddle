import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  template: `
    <div class="container">
      <ion-label>Hello</ion-label>
      <ion-button (click)="goToMap()">Load Map</ion-button>
    </div>
  `,
  styles: [`
    .container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    ion-label {
      font-size: 64px;
      font-family: 'Poppins', sans-serif;
      margin-bottom: 20px;
    }
    ion-button {
      font-size: 18px;
    }
  `]
})
export class HomeComponent {
  constructor(private router: Router) {}

  goToMap() {
    this.router.navigate(['/map']);
  }
}
