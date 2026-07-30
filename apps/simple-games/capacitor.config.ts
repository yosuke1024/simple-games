import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pixapps.simplegames',
  appName: 'Simple Games: Offline Puzzles',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // Keep the launch quiet and fast; the app itself boots offline instantly.
      launchShowDuration: 400,
      launchAutoHide: true,
      backgroundColor: '#f3f0e9',
      showSpinner: false,
    },
  },
};

export default config;
