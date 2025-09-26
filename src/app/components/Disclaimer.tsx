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
        This app is currently in <strong>beta</strong>, and some features may be unstable. For
        critical or large-scale use, we recommend{' '}
        <a href="https://docs.ethswarm.org/docs/bee/installation/getting-started/" target="_blank">
          running your own Bee node
        </a>
        . Start by uploading a few small files to get familiar with how it works.
      </p>
    </div>
  );
};

export default Disclaimer;
