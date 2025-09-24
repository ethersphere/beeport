import formbricks from '@formbricks/js';
import styles from './css/FeedbackButton.module.css';

const FeedbackButton: React.FC = () => {
  const handleClick = () => {
    formbricks.track('feedback');
  };

  return (
    <button onClick={handleClick} className={styles.button}>
      Feedback
    </button>
  );
};

export default FeedbackButton;
