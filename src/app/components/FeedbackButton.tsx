import formbricks from '@formbricks/js';
import { useEffect, useState } from 'react';
import styles from './css/FeedbackButton.module.css';

const FeedbackButton: React.FC = () => {
  const [show, setShow] = useState(false);

  const handleClick = () => {
    formbricks.track('share-feedback').then(() => {
      setShow(false);
    });
  };

  useEffect(() => {
    formbricks
      .setup({
        environmentId: process.env.NEXT_PUBLIC_FORMBRICKS_ENV_ID || 'cmejwregbbh89rj01io6z9670',
        appUrl: process.env.NEXT_PUBLIC_FORMBRICKS_APP_URL || 'https://app.formbricks.com',
      })
      .then(() => {
        setShow(true);
      });
  }, []);

  if (!show) {
    return null;
  }

  return (
    <button onClick={handleClick} className={styles.button}>
      Feedback
    </button>
  );
};

export default FeedbackButton;
