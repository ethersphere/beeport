import styles from './css/Disclaimer.module.css';

const Disclaimer: React.FC = () => {
  return (
    <div className={styles.disclaimerContainer}>
      <p>
        <strong>
          Beeport is the web2 rails for{' '}
          <a href="https://ethswarm.org/" target="_blank">
            Swarm
          </a>
        </strong>
        , making it quick and simple to upload and share files, websites, and more, without running
        a node.
      </p>
      <p>
        This app is currently in <strong>beta</strong>. Start by uploading a few small files to get
        familiar with how it works.
      </p>
      <p>
        You are on <strong>V2</strong> of Beeport. For V1 and old stamps go to{' '}
        <a href="https://beeport-v1.ethswarm.org/" target="_blank" rel="noopener noreferrer">
          V1 Beeport
        </a>
        .
      </p>
    </div>
  );
};

export default Disclaimer;
