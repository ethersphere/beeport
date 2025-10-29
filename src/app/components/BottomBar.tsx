import Disclaimer from './Disclaimer';
import FeedbackButton from './FeedbackButton';
import PriceTracker from './PriceTracker';
import styles from './css/BottomBar.module.css';

const BottomBar: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <PriceTracker />
      </div>
      <Disclaimer />
      <div className={styles.right}>
        <FeedbackButton />
      </div>
    </div>
  );
};

export default BottomBar;
