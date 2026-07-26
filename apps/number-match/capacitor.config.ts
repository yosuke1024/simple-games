import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pixapps.simplegames.numbermatch',
  appName: 'Number Match Offline',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // Keep the launch quiet and fast; the app itself boots offline instantly.
      launchShowDuration: 400,
      launchAutoHide: true,
      backgroundColor: '#f6f4ef',
      showSpinner: false,
    },
  },
};

export default config;
