import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from './providers';
import './globals.css';
import Script from 'next/script';
import { TrackJSAgent } from 'trackjs-nextjs';

export const metadata = {
  title: 'Beeport',
  description: 'Solutions for buying Bzz and obtaining postage stamps in multichain environment',
  icons: {
    icon: './favicon.png', // Standard favicon
    shortcut: './favicon.png', // Shortcut icon for iOS
  },
};

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <TrackJSAgent
          config={{
            token: '2718ca1ab72d4ff38899696b48210d39',
          }}
        />
        <Script id="matomo-analytics" strategy="afterInteractive">
          {`
            var _paq = window._paq = window._paq || [];
            /* tracker methods like "setCustomDimension" should be called before "trackPageView" */
            _paq.push(['trackPageView']);
            _paq.push(['enableLinkTracking']);
            (function() {
              var u="https://mtm.swarm.foundation/";
              _paq.push(['setTrackerUrl', u+'matomo.php']);
              _paq.push(['setSiteId', '19']);
              var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
              g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
            })();
          `}
        </Script>
      </head>
      <body className="swarm-theme">
        <div className="main-container">
          <main className="content">
            <Providers>{children}</Providers>
          </main>
        </div>
      </body>
    </html>
  );
}

export default RootLayout;
