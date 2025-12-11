import Image from 'next/image';
import styles from './css/GitHubLink.module.css';

const GitHubLink: React.FC = () => {
  return (
    <a
      href="https://github.com/ethersphere/beeport"
      target="_blank"
      rel="noopener noreferrer"
      className={styles.link}
      aria-label="GitHub"
    >
      <Image
        src="/github-mark-white.svg"
        alt="GitHub"
        width={20}
        height={20}
        className={styles.icon}
      />
    </a>
  );
};

export default GitHubLink;
