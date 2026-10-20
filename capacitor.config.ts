import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jarvis.pessoal',
  appName: 'JARVIS',
  webDir: 'dist',
  backgroundColor: '#070814',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Tela de ponta a ponta com ícones claros na barra de status (fundo escuro)
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
      initialViewportFitValueHint: 'cover',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_jarvis',
      iconColor: '#7cc4ff',
    },
  },
};

export default config;
