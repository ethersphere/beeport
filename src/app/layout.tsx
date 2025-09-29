import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from './providers';
import './globals.css';
import Script from 'next/script';

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
        <Script id="logrocket-analytics" strategy="afterInteractive">
          {`
            (function() {
              var script = document.createElement('script');
              script.src = 'https://cdn.lr-in.com/LogRocket.min.js';
              script.async = true;
              script.onload = function() {
                window.LogRocket && window.LogRocket.init('bxvp76/beeport');
              };
              document.head.appendChild(script);
            })();
          `}
        </Script>
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
