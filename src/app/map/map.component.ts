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
  realTimeMode = false; 

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
    const apiKey = 'AIzaSyB2N3TfsybLCoYEi8m17tr6qLbCeUUsBmI';

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
    const waypointAlert = await this.alertController.create({
      header: 'Number of Waypoints',
      message: 'Enter the number of waypoints for this game session.',
      inputs: [
        {
          name: 'waypointCount',
          type: 'number',
          placeholder: 'e.g., 5'
        }
      ],
      buttons: [
        {
          text: 'Next',
          handler: async (data) => {
            const waypointCount = parseInt(data.waypointCount, 10);
            if (isNaN(waypointCount) || waypointCount <= 0) {
              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: 'Please enter a valid number of waypoints.',
                buttons: [{ text: 'OK' }]
              });
              await errorAlert.present();
              return false;
            }
  
            this.waypointCount = waypointCount;
            this.showModeSelection(); 
            return true;
          }
        }
      ]
    });
    await waypointAlert.present();
  }

  async showModeSelection() {
    const modeAlert = await this.alertController.create({
      header: 'Select Mode',
      message: 'Choose the game mode.',
      inputs: [
        {
          name: 'mode',
          type: 'radio',
          label: 'Manual',
          value: 'manual',
          checked: true
        },
        {
          name: 'mode',
          type: 'radio',
          label: 'Real-Time',
          value: 'real-time'
        }
      ],
      buttons: [
        {
          text: 'Start',
          handler: async (data) => {
            this.realTimeMode = data === 'real-time';
            this.gameStarted = true;
            this.incorrectAttempts = 0;
  
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
                iconUrl: 'https://maps.google.com/mapfiles/dir_0.png',
                draggable: !this.realTimeMode,
              });
  
              if (this.realTimeMode) {
                this.trackRealTimeLocation();
              } else {
                this.map.setOnMarkerDragListener(async (event) => {
                  if (event.markerId === this.userMarkerId) {
                    this.checkProximityToWaypoint(event.latitude, event.longitude);
                  }
                });
              }
  
              await this.loadWaypoints(userLat, userLng);
            });
          }
        }
      ]
    });
    await modeAlert.present();
  }
  
  
  trackRealTimeLocation() {
    navigator.geolocation.watchPosition(async (position) => {
      const { latitude, longitude } = position.coords;
  
      await this.map.setCamera({
        coordinate: { lat: latitude, lng: longitude },
        zoom: 15
      });

      if (this.userMarkerId) {
        await this.map.removeMarker(this.userMarkerId);
      }

      this.userMarkerId = await this.map.addMarker({
        coordinate: { lat: latitude, lng: longitude },
        title: 'Your Location',
        iconUrl: 'https://maps.google.com/mapfiles/dir_0.png',
        draggable: false
      });
  
      this.checkProximityToWaypoint(latitude, longitude);
    });
  }
  

  async loadWaypoints(latitude: number, longitude: number) {
    // Commenting out the API call
    /*
    this.waypoints = await this.http.get<Point[]>(
      `http://localhost:5211/api/Point?latitude=${latitude}&longitude=${longitude}&count=${this.waypointCount}`
    ).toPromise() || [];
    */
  
    // Generate random waypoints within a 1 km radius
    const radiusInMeters = 1000; // 1 km radius
    const randomWaypoints: Point[] = [];
  
    for (let i = 0; i < this.waypointCount; i++) {
      const { lat, lng } = this.getRandomLocationWithinRadius(latitude, longitude, radiusInMeters);
      randomWaypoints.push({
        latitude: lat,
        longitude: lng,
        question: {
          text: 'What is 2 + 2?',
          answers: ['3', '4', '5'],
          correctIndex: 1
        }
      });
    }
  
    this.waypoints = randomWaypoints;
  
    for (const waypoint of this.waypoints) {
      const markerId = await this.map.addMarker({
        coordinate: { lat: waypoint.latitude, lng: waypoint.longitude },
        title: `Waypoint`,
      });
      waypoint.markerId = markerId;
    }
  }
  
  getRandomLocationWithinRadius(latitude: number, longitude: number, radiusInMeters: number) {
    const radiusInDegrees = radiusInMeters / 111300; 
    const u = Math.random();
    const v = Math.random();
    const w = radiusInDegrees * Math.sqrt(u);
    const t = 2 * Math.PI * v;
    const deltaLat = w * Math.cos(t);
    const deltaLng = w * Math.sin(t) / Math.cos(latitude * Math.PI / 180);
    return { lat: latitude + deltaLat, lng: longitude + deltaLng };
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

      alert.dismiss();

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
                this.startGame();
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
