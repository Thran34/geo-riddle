import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { GoogleMap } from '@capacitor/google-maps';
import { AlertController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';

interface Point {
  latitude: number;
  longitude: number;
  question: Question;
  markerId?: string;
}

interface Question {
  text: string;
  answers: string[];
  correctIndex: number;
}

@Component({
  selector: 'app-map',
  template: `
    <capacitor-google-map #mapContainer></capacitor-google-map>
    <div class="button-container" *ngIf="!gameStarted">
      <ion-button (click)="startGame()">Start Game</ion-button>
    </div>
  `,
  styles: [`
    capacitor-google-map {
      display: inline-block;
      width: 100%;
      height: 100vh;
    }
    .button-container {
      position: absolute;
      bottom: 20px;
      right: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    ion-button {
      --background: #3880ff;
      --border-radius: 10px;
      --padding-start: 16px;
      --padding-end: 16px;
    }
  `]
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapRef!: ElementRef<HTMLElement>;
  map!: GoogleMap;
  userMarkerId!: string | null;
  waypoints: Point[] = [];
  gameStarted = false;
  waypointCount = 5;
  incorrectAttempts = 0;
  questionActive = false;

  constructor(
    private alertController: AlertController,
    private http: HttpClient
  ) {}

  ngAfterViewInit() {
    this.createMap();
  }

  ngOnDestroy() {
    if (this.userMarkerId) {
      this.map.removeMarker(this.userMarkerId);
    }
  }

  async createMap() {
    const apiKey = 'YOUR_API_KEY_HERE';

    this.map = await GoogleMap.create({
      id: 'my-map',
      element: this.mapRef.nativeElement,
      apiKey: apiKey,
      config: {
        center: { lat: 0, lng: 0 },
        zoom: 15,
      },
    });
  }

  async startGame() {
    const alert = await this.alertController.create({
      header: 'Start Game',
      message: 'Enter the number of waypoints for this game session',
      inputs: [
        {
          name: 'waypointCount',
          type: 'number',
          placeholder: 'e.g., 5'
        }
      ],
      buttons: [
        {
          text: 'Start',
          handler: async (data) => {
            this.waypointCount = +data.waypointCount || this.waypointCount;
            this.gameStarted = true;
            this.incorrectAttempts = 0;

            // Remove existing player marker if it exists
            if (this.userMarkerId) {
              await this.map.removeMarker(this.userMarkerId);
            }

            navigator.geolocation.getCurrentPosition(async (position) => {
              const userLat = position.coords.latitude;
              const userLng = position.coords.longitude;

              await this.map.setCamera({
                coordinate: { lat: userLat, lng: userLng },
                zoom: 15,
              });

              this.userMarkerId = await this.map.addMarker({
                coordinate: { lat: userLat, lng: userLng },
                title: 'Your Location',
                iconUrl: 'https://maps.google.com/mapfiles/kml/shapes/man.png',
                draggable: true,
              });

              this.map.setOnMarkerDragListener(async (event) => {
                if (event.markerId === this.userMarkerId) {
                  this.checkProximityToWaypoint(event.latitude, event.longitude);
                }
              });

              await this.loadWaypoints(userLat, userLng);
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async loadWaypoints(latitude: number, longitude: number) {
    this.waypoints = await this.http.get<Point[]>(
      `http://localhost:5211/api/Point?latitude=${latitude}&longitude=${longitude}&count=${this.waypointCount}`
    ).toPromise() || [];

    for (const waypoint of this.waypoints) {
      const markerId = await this.map.addMarker({
        coordinate: { lat: waypoint.latitude, lng: waypoint.longitude },
        title: `Waypoint`,
      });
      waypoint.markerId = markerId;
    }
  }

  checkProximityToWaypoint(userLat: number, userLng: number) {
    if (this.questionActive) return;

    for (const waypoint of this.waypoints) {
      const distance = this.calculateDistance(userLat, userLng, waypoint.latitude, waypoint.longitude);
      if (distance < 0.01) {
        this.questionActive = true;
        this.presentQuestion(waypoint);
        break;
      }
    }
  }

  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
    const p = Math.PI / 180;
    const a = 0.5 - Math.cos((lat2 - lat1) * p) / 2 +
              Math.cos(lat1 * p) * Math.cos(lat2 * p) *
              (1 - Math.cos((lng2 - lng1) * p)) / 2;
    return 12742 * Math.asin(Math.sqrt(a));
  }

  async presentQuestion(waypoint: Point) {
    const question = waypoint.question;
    const alert = await this.alertController.create({
      header: question.text,
      message: `You have ${3 - this.incorrectAttempts} attempts left.`,
      backdropDismiss: false,
      buttons: question.answers.map((answer: string, index: number) => ({
        text: answer,
        handler: () => this.checkAnswer(index === question.correctIndex, waypoint, alert)
      }))
    });
    await alert.present();
  }

  async checkAnswer(isCorrect: boolean, waypoint: Point, alert: HTMLIonAlertElement) {
    if (isCorrect) {
      this.questionActive = false;
      if (waypoint.markerId) {
        await this.map.removeMarker(waypoint.markerId);
      }
      this.waypoints = this.waypoints.filter(wp => wp !== waypoint);

      const correctAlert = await this.alertController.create({
        header: 'Correct!',
        message: 'You answered correctly.',
        buttons: [{ text: 'OK' }]
      });
      await correctAlert.present();

      alert.dismiss(); // Close question alert on correct answer

      if (this.waypoints.length === 0) {
        this.gameStarted = false;

        const congratsAlert = await this.alertController.create({
          header: 'Congratulations!',
          message: 'You have cleared all waypoints.',
          buttons: [
            {
              text: 'Play Again',
              handler: () => {
                this.resetGame();
                this.startGame(); // Restart game on successful completion
              }
            }
          ]
        });
        await congratsAlert.present();
      }

      return true;
    } else {
      this.incorrectAttempts++;

      if (this.incorrectAttempts >= 3) {
        alert.dismiss();

        const gameOverAlert = await this.alertController.create({
          header: 'Game Over',
          message: 'You answered incorrectly three times.',
          buttons: [
            {
              text: 'Restart Game',
              handler: () => {
                this.resetGame();
                this.startGame();
              }
            },
            {
              text: 'OK',
              handler: () => this.resetGame()
            }
          ]
        });
        await gameOverAlert.present();
        return true;
      } else {
        alert.message = `Incorrect. You have ${3 - this.incorrectAttempts} attempts left.`;
        return false;
      }
    }
  }

  async resetGame() {
    this.gameStarted = false;
    this.incorrectAttempts = 0;
    this.questionActive = false;

    // Clear existing waypoints and player marker
    if (this.userMarkerId) {
      await this.map.removeMarker(this.userMarkerId);
      this.userMarkerId = null;
    }
    this.waypoints.forEach(async (wp) => {
      if (wp.markerId) await this.map.removeMarker(wp.markerId);
    });
    this.waypoints = [];
  }
}
