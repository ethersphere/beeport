import { useEffect, useState } from 'react';
import styles from './css/Disclaimer.module.css';

const Disclaimer: React.FC = () => {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('disclaimerAccepted');
    if (!consent) {
      setShowConsent(true);
    }
  }, []);

  function acceptDisclaimer() {
    localStorage.setItem('disclaimerAccepted', 'true');
    setShowConsent(false);
  }

  const p1 = (
    <p>
      Beeport is the web2 rails for{' '}
      <a href="https://ethswarm.org/" target="_blank">
        Swarm
      </a>
      , making it quick and simple to upload and share files, websites, and more, without running a
      node.
    </p>
  );

  const p2 = (
    <p>
      This app is currently in <strong>beta</strong>, and some features may be unstable. For
      critical or large-scale use, we recommend{' '}
      <a href="https://docs.ethswarm.org/docs/bee/installation/getting-started/" target="_blank">
        running your own Bee node
      </a>
      . Start by uploading a few small files to get familiar with how it works.
    </p>
  );

  if (showConsent) {
    return (
      <dialog className={styles.disclaimerDialog} open>
        <div className={styles.disclaimerDialogContent}>
          {p1}
          {p2}
          <button onClick={acceptDisclaimer} className={styles.button}>
            I Understand
          </button>
        </div>
      </dialog>
    );
  }

  return (
    <div className={styles.disclaimerContainer}>
      {p1}
      {p2}
    </div>
  );
};

export default Disclaimer;
