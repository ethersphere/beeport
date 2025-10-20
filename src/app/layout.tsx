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
        <meta property="og:title" content="Swarm Beeport" />
        <meta
          property="og:description"
          content="Beeport is the web2 rails for Swarm making it quick and simple to upload and share files, websites, and more, without running a node."
        />
        <meta property="og:image" content="https://www.ethswarm.org/uploads/beeportOG.png" />
        <meta property="og:url" content="https://beeport.ethswarm.org/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@ethswarm" />
        <meta name="twitter:title" content="Swarm Beeport" />
        <meta
          name="twitter:description"
          content="Beeport is the web2 rails for Swarm making it quick and simple to upload and share files, websites, and more, without running a node."
        />
        <meta name="twitter:image" content="https://www.ethswarm.org/uploads/beeportOG.png" />
        <meta name="twitter:url" content="https://beeport.ethswarm.org/" />
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
