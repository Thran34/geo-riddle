import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'geo-riddle',
  webDir: 'www',
  bundledWebRuntime: false,
  plugins: {
    GoogleMaps: {
      apiKey: 'AIzaSyB2N3TfsybLCoYEi8m17tr6qLbCeUUsBmI',
    },
  },
};

export default config;
