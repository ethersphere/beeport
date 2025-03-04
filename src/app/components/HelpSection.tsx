import React from "react";
import styles from "./css/HelpSection.module.css";
import { DEFAULT_BEE_API_URL } from "./constants";

interface HelpSectionProps {
  nodeAddress: string;
  beeApiUrl: string;
  setNodeAddress: (value: string) => void;
  setBeeApiUrl: (value: string) => void;
  setShowHelp: (value: boolean) => void;
  isCustomNode: boolean;
  setIsCustomNode: (value: boolean) => void;
}

const HelpSection: React.FC<HelpSectionProps> = ({
  nodeAddress,
  beeApiUrl,
  setNodeAddress,
  setBeeApiUrl,
  setShowHelp,
  isCustomNode,
  setIsCustomNode,
}) => {
  const handleBeeApiUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Remove trailing slashes
    value = value.replace(/\/+$/, "");
    setBeeApiUrl(value);
  };

  const handleCustomNodeToggle = (checked: boolean) => {
    setIsCustomNode(checked);
    if (!checked) {
      // Reset to default URL when turning off custom node
      setBeeApiUrl(DEFAULT_BEE_API_URL);
    }
  };

  return (
    <div className={styles.helpContainer}>
      <h1 className={styles.title}>Help</h1>

      <div className={styles.helpContent}>
        <div className={styles.configHeader}>
          <h2>Configuration</h2>
          <button
            className={`${styles.button} ${styles.helpButton}`}
            onClick={() => setShowHelp(false)}
          >
            Back
          </button>
        </div>

        <div className={styles.customNodeSection}>
          <div className={styles.switchContainer}>
            <span className={styles.switchLabel}>Custom Node</span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={isCustomNode}
                onChange={(e) => handleCustomNodeToggle(e.target.checked)}
              />
              <span className={styles.slider}></span>
            </label>
          </div>

          {isCustomNode && (
            <div className={styles.customNodeConfig}>
              <div className={styles.formSection}>
                <label className={styles.label}>BEE API URL:</label>
                <input
                  className={styles.input}
                  type="text"
                  value={beeApiUrl}
                  onChange={handleBeeApiUrlChange}
                  placeholder="Enter Bee API URL"
                />
                <div className={styles.nodeAddress}>
                  Node Address: <span>{nodeAddress}</span>
                </div>
                <div className={styles.hint}>
                  Change it to custom value if you have NGROK running or remote
                  node
                </div>
              </div>
            </div>
          )}
        </div>

        <h2>How to use this dapp?</h2>
        <ol>
          <li>
            <h3>Using swarm central node</h3>
            <p>
              By default this app provides central node for uploads and you can
              just buy storage and upload data
            </p>
          </li>
          <li>
            <h3>Using local node</h3>
            <p>
              Connect to your local node, you need a PAID plan for NGROK to
              expose it to world and then start it with this command "ngrok http
              1633 --request-header-add="ngrok-skip-browser-warning:1"
            </p>
          </li>
          <li>
            <h3>Remote node</h3>
            <p>
              This app can also be run with remote node, hosted on a server and
              its endpoints exposed, you can use{" "}
              <a
                href="https://github.com/ethersphere/multichain/blob/main/src/misc/index.js"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                this code snippet
              </a>{" "}
              for that, or make your own
            </p>
          </li>
        </ol>

        <h2>Frequently Asked Questions</h2>
        <div className={styles.faqSection}>
          <div className={styles.faqItem}>
            <h3>What happens if my upload fails?</h3>
            <p>
              If an upload fails, the system will automatically retry several
              times. If it continues to fail, your stamps and tokens remain
              safe, and you can try the upload again. The most common cause of
              upload failures is network connectivity issues.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>How long does it take for my storage to become available?</h3>
            <p>
              After purchasing storage, it typically takes 2-5 minutes for your
              storage bucket to become usable. The app will automatically notify
              you once your storage is ready for use.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h3>I get "no routes available", why? </h3>
            <p>
              If messaged "no routes available", this usually means that you
              choose too low amount of USD value to be crossed between chains.
              For below $0.5 you should try to swap and upload directly from
              Gnosis chain.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h3>How to prepare TAR archive? </h3>
            <p>
              Use "tar -C my_folder -cf my_folder.tar ." command to make your
              folder ready for upload as TAR file. Swarm doesnt suppor gzip so
              dont include -z flag
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpSection;
