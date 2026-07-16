import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.productivenotes',
  appName: 'Productive Notes',
  webDir: 'dist',
  backgroundColor: '#0f172a',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#0f172a',
      showSpinner: false
    }
  }
}

export default config
