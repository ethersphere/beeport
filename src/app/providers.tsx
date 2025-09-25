'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';

// Import correct config from the existing wagmi.ts
import { config } from './wagmi';

// Custom Swarm theme by extending the darkTheme directly
const swarmTheme = {
  ...darkTheme(),
  colors: {
    ...darkTheme().colors,
    accentColor: '#ff7a00',
    accentColorForeground: '#ffffff',
    connectButtonBackground: '#ff7a00',
    connectButtonBackgroundError: '#ff5a52',
    connectButtonInnerBackground: '#161b22',
    connectButtonText: '#ffffff',
    connectButtonTextError: '#ffffff',
    modalBackground: '#0f131a',
    modalBorder: '#30363d',
    modalText: '#ffffff',
    modalTextSecondary: '#8b949e',
  },
  radii: {
    ...darkTheme().radii,
    actionButton: '8px',
    connectButton: '8px',
    menuButton: '8px',
    modal: '12px',
    modalMobile: '12px',
  },
};

const queryClient = new QueryClient();

export function Providers({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={swarmTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
