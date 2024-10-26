import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { GoogleMap } from '@capacitor/google-maps';

@Component({
  selector: 'app-map',
  template: `
    <capacitor-google-map #mapContainer></capacitor-google-map>
    <div class="button-container">
      <ion-button (click)="loadWaypoint()">Load Waypoint</ion-button>
      <ion-button (click)="clearWaypoints()">Clear Waypoints</ion-button>
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
  watchId!: number;
  waypoints: any[] = []; // Array to store waypoints
  lastWaypoint: { lat: number; lng: number } | null = null; // Store the last added waypoint or user location
  polylines: string[] = []; // Store polyline IDs to clear them later

  ngAfterViewInit() {
    this.createMap();
  }

  ngOnDestroy() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }
  }

  // Utility function to generate random coordinates within a radius
  getRandomLocation(lat: number, lng: number, radius: number) {
    const r = radius / 111300; // Convert meters to degrees
    const u = Math.random();
    const v = Math.random();
    const w = r * Math.sqrt(u);
    const t = 2 * Math.PI * v;
    const newLat = lat + w * Math.cos(t);
    const newLng = lng + w * Math.sin(t);
    return { lat: newLat, lng: newLng };
  }

  async createMap() {
    const apiKey = 'YOUR_GOOGLE_MAPS_API_KEY';

    this.map = await GoogleMap.create({
      id: 'my-map',
      element: this.mapRef.nativeElement,
      apiKey: apiKey,
      config: {
        center: { lat: 0, lng: 0 },
        zoom: 15,
        styles: [
          // Custom styles (optional)
        ]
      },
    });

    // Watch the user's location in real-time
    this.watchId = navigator.geolocation.watchPosition(async (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      if (this.userMarkerId) {
        await this.map.removeMarker(this.userMarkerId);
      }

      // Add a new marker for the user's location
      this.userMarkerId = await this.map.addMarker({
        coordinate: { lat: userLat, lng: userLng },
        title: 'Your Location',
        iconUrl: 'https://maps.google.com/mapfiles/kml/shapes/man.png' // Optional: Add custom icon for the user
      });

      // Update the last known location to the user's position if no waypoints are present
      if (!this.lastWaypoint) {
        this.lastWaypoint = { lat: userLat, lng: userLng };
      }

      // Optionally, keep the camera centered on the user's location
      await this.map.setCamera({
        coordinate: { lat: userLat, lng: userLng },
        zoom: 15,
      });
    }, (error) => {
      console.error('Error watching location', error);
    });
  }

  async loadWaypoint() {
    if (!this.lastWaypoint) return;

    // Generate a new random waypoint within 1km of the last waypoint or user location
    const newWaypoint = this.getRandomLocation(this.lastWaypoint.lat, this.lastWaypoint.lng, 1000);

    // Add the waypoint marker to the map
    await this.map.addMarker({
      coordinate: { lat: newWaypoint.lat, lng: newWaypoint.lng },
      title: 'Waypoint',
    });

    // Add the waypoint to the waypoints list
    this.waypoints.push(newWaypoint);

    // Draw a polyline connecting the last waypoint/user location to the new waypoint
    const polylineIds = await this.map.addPolylines([{
      path: [
        { lat: this.lastWaypoint.lat, lng: this.lastWaypoint.lng },
        { lat: newWaypoint.lat, lng: newWaypoint.lng }
      ],
      strokeColor: '#FF0000',
      strokeWeight: 5,
      clickable: false,
    }]);

    // Store the polyline ID(s) so we can clear them later
    this.polylines.push(...polylineIds);

    // Update the last waypoint
    this.lastWaypoint = newWaypoint;
  }

  async clearWaypoints() {
    // Clear all waypoint markers and polylines
    if (this.polylines.length > 0) {
      await this.map.removePolylines(this.polylines); // Remove all polylines
    }
    this.polylines = [];
    this.waypoints = [];
    this.lastWaypoint = null; // Reset to user position for the next load
  }
}
