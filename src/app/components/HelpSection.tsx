import React from 'react';
import styles from './css/HelpSection.module.css';
import {
  DEFAULT_BEE_API_URL,
  DEFAULT_SLIPPAGE,
  MIN_SLIPPAGE_PERCENT,
  MAX_SLIPPAGE_PERCENT,
} from './constants';

interface HelpSectionProps {
  nodeAddress: string;
  beeApiUrl: string;
  setBeeApiUrl: (value: string) => void;
  isCustomNode: boolean;
  setIsCustomNode: (value: boolean) => void;
  isCustomRpc: boolean;
  setIsCustomRpc: (value: boolean) => void;
  customRpcUrl: string;
  setCustomRpcUrl: (value: string) => void;
  useCustomSlippage: boolean;
  setUseCustomSlippage: (value: boolean) => void;
  customSlippagePercent: number;
  setCustomSlippagePercent: (value: number) => void;
}

const HelpSection: React.FC<HelpSectionProps> = ({
  nodeAddress,
  beeApiUrl,
  setBeeApiUrl,
  isCustomNode,
  setIsCustomNode,
  isCustomRpc,
  setIsCustomRpc,
  customRpcUrl,
  setCustomRpcUrl,
  useCustomSlippage,
  setUseCustomSlippage,
  customSlippagePercent,
  setCustomSlippagePercent,
}) => {
  const handleBeeApiUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Remove trailing slashes
    value = value.replace(/\/+$/, '');
    setBeeApiUrl(value);
  };

  const handleCustomNodeToggle = (checked: boolean) => {
    setIsCustomNode(checked);
    if (!checked) {
      // Reset to default URL when turning off custom node
      setBeeApiUrl(DEFAULT_BEE_API_URL);
    }
  };

  const handleCustomRpcUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Remove trailing slashes
    value = value.replace(/\/+$/, '');
    setCustomRpcUrl(value);
  };

  const handleCustomRpcToggle = (checked: boolean) => {
    setIsCustomRpc(checked);
    if (!checked) {
      // Reset to default when turning off custom RPC
      setCustomRpcUrl('');
    }
  };

  const handleCustomSlippageToggle = (checked: boolean) => {
    setUseCustomSlippage(checked);
    if (!checked) {
      setCustomSlippagePercent(DEFAULT_SLIPPAGE);
    }
  };

  const handleCustomSlippageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      setCustomSlippagePercent(DEFAULT_SLIPPAGE);
      return;
    }
    const num = parseFloat(raw);
    if (!Number.isNaN(num)) {
      const clamped = Math.min(MAX_SLIPPAGE_PERCENT, Math.max(MIN_SLIPPAGE_PERCENT, num));
      setCustomSlippagePercent(clamped);
    }
  };

  return (
    <div className={styles.helpContainer}>
      <div className={styles.helpContent}>
        <div className={styles.helpHeader}>
          <h2>Settings</h2>
        </div>

        <div className={styles.customNodeSection}>
          <div className={styles.switchContainer}>
            <span className={styles.switchLabel}>Custom Node</span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={isCustomNode}
                onChange={e => handleCustomNodeToggle(e.target.checked)}
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

                <div className={styles.hint}>
                  Change API URL to custom value if you have remote node or local node running
                </div>
                <div className={styles.nodeAddress}>API Node Address {nodeAddress}</div>
              </div>
            </div>
          )}

          <div className={styles.switchContainer} style={{ marginTop: '20px' }}>
            <span className={styles.switchLabel}>Custom RPC</span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={isCustomRpc}
                onChange={e => handleCustomRpcToggle(e.target.checked)}
              />
              <span className={styles.slider}></span>
            </label>
          </div>

          {isCustomRpc && (
            <div className={styles.customNodeConfig}>
              <div className={styles.formSection}>
                <label className={styles.label}>Gnosis RPC URL:</label>
                <input
                  className={styles.input}
                  type="text"
                  value={customRpcUrl}
                  onChange={handleCustomRpcUrlChange}
                  placeholder="Enter Gnosis RPC URL"
                />

                <div className={styles.hint}>
                  Set custom RPC URL for the Gnosis chain. This will be used for all Gnosis chain
                  operations.
                </div>
              </div>
            </div>
          )}

          <div className={styles.switchContainer} style={{ marginTop: '20px' }}>
            <span className={styles.switchLabel}>Custom slippage</span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={useCustomSlippage}
                onChange={e => handleCustomSlippageToggle(e.target.checked)}
              />
              <span className={styles.slider}></span>
            </label>
          </div>

          {useCustomSlippage && (
            <div className={styles.customNodeConfig}>
              <div className={styles.formSection}>
                <label className={styles.label}>Slippage (%)</label>
                <input
                  className={styles.input}
                  type="number"
                  min={MIN_SLIPPAGE_PERCENT}
                  max={MAX_SLIPPAGE_PERCENT}
                  step={0.5}
                  value={customSlippagePercent}
                  onChange={handleCustomSlippageChange}
                  placeholder={`${DEFAULT_SLIPPAGE}`}
                />

                <div className={styles.hint}>
                  Swap tolerance in percentages. Used for Relay swaps when buying storage. Allows 0.5
                  steps (e.g. 0.5, 1, 1.5). Default is {DEFAULT_SLIPPAGE}%.
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
              By default this app provides central node for uploads and you can just buy storage and
              upload data
            </p>
          </li>
          <li>
            <h3>Using local node</h3>
            <p>
              Connect to your local node, you need a PAID plan for NGROK to expose it to world and
              then start it with this command &quot;ngrok http 1633
              --request-header-add=&quot;ngrok-skip-browser-warning:1&quot;&quot;
            </p>
          </li>
          <li>
            <h3>Remote node</h3>
            <p>
              This app can also be run with remote node, hosted on a server and its endpoints
              exposed, you can use{' '}
              <a
                href="https://github.com/ethersphere/beeport/blob/main/backend/index.js"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                this code snippet
              </a>{' '}
              for that, or make your own
            </p>
          </li>
        </ol>

        <h2>Frequently Asked Questions</h2>
        <div className={styles.faqSection}>
          <div className={styles.faqItem}>
            <h3>What happens if my upload fails?</h3>
            <p>
              If an upload fails, the system will automatically retry several times. If it continues
              to fail, your stamps and tokens remain safe, and you can try the upload again. The
              most common cause of upload failures is network connectivity issues.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>How long does it take for my storage to become available?</h3>
            <p>
              After purchasing storage, it typically takes 2-5 minutes for your storage stamps to
              become usable. The app will automatically notify you once your storage is ready for
              use.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h3>Upload history</h3>
            <p>
              Upload history is kept in the browser&apos;s storage. Clearing the storage/cache of
              the browser will irreversibly destroy the upload history. When switching browsers, you
              can migrate this data manually using the IMPORT and EXPORT buttons, otherwise your
              upload history will start empty.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h3>Stamp persistence</h3>
            <p>
              Your storage stamps are linked to your wallet address, not to your browser. This means
              when you connect the same wallet to Beeport on a different browser or machine, all
              your previously purchased stamps will automatically be loaded and available for use.
              You can seamlessly continue uploading files using your existing stamps from any device
              where you connect your wallet.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h3>How to prepare archives? </h3>
            <p>
              Use &quot;tar -C my_folder -cf my_folder.tar .&quot; command to make your folder ready
              for upload as TAR file. You can also upload ZIP files and GZIP files.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpSection;
