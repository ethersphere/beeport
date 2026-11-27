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
  showAdvancedInfo: boolean;
  setShowAdvancedInfo: (value: boolean) => void;
  /** Connected wallet address (the hot key is derived from it). */
  walletAddress?: string;
  /** Full hot-key address, if derived in this browser (active session or cached). */
  hotKeyAddress?: string;
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
  showAdvancedInfo,
  setShowAdvancedInfo,
  walletAddress,
  hotKeyAddress,
}) => {
  const [copied, setCopied] = React.useState(false);
  const copyHotKey = async () => {
    if (!hotKeyAddress) return;
    try {
      await navigator.clipboard.writeText(hotKeyAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the address stays selectable
    }
  };

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

          <div className={styles.switchContainer} style={{ marginTop: '20px' }}>
            <span className={styles.switchLabel}>Advanced mode</span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={showAdvancedInfo}
                onChange={e => setShowAdvancedInfo(e.target.checked)}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
          {showAdvancedInfo && (
            <div className={styles.customNodeConfig}>
              <div className={styles.hint} style={{ marginTop: 0 }}>
                Advanced mode shows technical details in the storage list:
                <ul className={styles.advancedList}>
                  <li>
                    <strong>Status line:</strong> Healthy, Getting full, Almost full or Full, based
                    on the fullest bucket.
                  </li>
                  <li>
                    <strong>Bucket stats:</strong> the fullest bucket and a chart of how many
                    buckets hold 0, 1, 2 or more chunks.
                  </li>
                  <li>
                    <strong>Reset local state:</strong> clears the saved counters of one storage.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <h2 className={styles.sectionTitle}>How to use this dapp?</h2>
        <p className={styles.howToIntro}>
          Beeport is fully self-custody: every chunk is BMT-hashed and postage-stamped in your
          browser before it is POSTed to a Bee node. There is no application server — you just
          need a Bee node that&apos;s reachable from your browser. Pick whichever fits your setup:
        </p>
        <div className={styles.faqList}>
          <details className={styles.faqItem}>
            <summary>Default Bee gateway</summary>
            <div className={styles.faqAnswer}>
              <p>
              Out of the box the app talks to a public Bee gateway, so you can connect your wallet,
              buy storage, and upload right away — nothing to install.
            </p>
            </div>
          </details>
          <details className={styles.faqItem}>
            <summary>Local Bee node</summary>
            <div className={styles.faqAnswer}>
              <p>
              Install{' '}
              <a
                href="https://www.ethswarm.org/build/swarm-desktop"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                Swarm Desktop
              </a>{' '}
              or run a standalone Bee node, then enable <strong>Custom Node</strong> above and
              point it at <code>http://localhost:1633</code>. No tunnel is needed when you&apos;re
              using the dapp on the same machine.
            </p>
            </div>
          </details>
          <details className={styles.faqItem}>
            <summary>Self-hosted remote Bee node</summary>
            <div className={styles.faqAnswer}>
              <p>
              You can also point the app at a Bee node on your own server. All you need is TLS
              termination and permissive CORS in front of it — a minimal nginx config is in{' '}
              <a
                href="https://github.com/ethersphere/beeport/blob/main/docs/self-hosting-bee-gateway.md"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                docs/self-hosting-bee-gateway.md
              </a>
              . For a quick demo you can also tunnel a local node with a paid NGROK plan:{' '}
              <code>ngrok http 1633 --request-header-add=&quot;ngrok-skip-browser-warning:1&quot;</code>
              .
            </p>
            </div>
          </details>
        </div>

        <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
        <div className={styles.faqSection}>
          <details className={styles.faqItem}>
            <summary>What happens if my upload fails?</summary>
            <div className={styles.faqAnswer}>
              <p>
              If an upload fails, the system will automatically retry several times. If it continues
              to fail, your tokens remain safe, and you can try the upload again. The most common
              cause of upload failures is network connectivity issues.
            </p>
            </div>
          </details>

          <details className={styles.faqItem}>
            <summary>How long does it take for my storage to become available?</summary>
            <div className={styles.faqAnswer}>
              <p>
              After purchasing storage, it typically takes 2-5 minutes for it to become usable. The
              app will automatically notify you once your storage is ready for use.
            </p>
            </div>
          </details>
          <details className={styles.faqItem}>
            <summary>Your files list</summary>
            <div className={styles.faqAnswer}>
              <p>
              The list of your files is kept in the browser&apos;s storage. Clearing the storage/cache
              of the browser will irreversibly destroy the list. When switching browsers, you can
              migrate this data manually using the IMPORT and EXPORT buttons, otherwise your list
              will start empty.
            </p>
            </div>
          </details>
          <details className={styles.faqItem}>
            <summary>What is the hot key?</summary>
            <div className={styles.faqAnswer}>
              <p>
                Every storage has an owner on the blockchain, and the owner must sign each piece
                of data you upload. Your wallet would have to sign thousands of times, so Beeport
                uses a helper key instead: the hot key.
              </p>
              <p>
                The first time you buy or upload, your wallet signs one fixed message. Beeport
                turns that signature into the hot key, in your browser. The key is not saved and
                not sent anywhere. After 15 minutes without activity, Beeport clears it from
                memory and asks for the signature again.
              </p>
              <p>
                You have one hot key for each wallet address, and all your storages use it. You get
                the same hot key on every browser and device with the same wallet, so you cannot
                lose it. If you lose the wallet, you lose access to your storage.
              </p>
              <p>
                The hot key cannot move your funds. It can only sign uploads to your storage. Sign
                the Beeport message only on Beeport. You can see your hot key at the top of this
                page.
              </p>
            </div>
          </details>
          <details className={styles.faqItem}>
            <summary>How does my storage fill up?</summary>
            <div className={styles.faqAnswer}>
              <p>
                Your storage is split into 65,536 buckets. Each bucket holds a fixed number of
                chunks (a chunk is 4 KB). For example, a storage of depth 19 holds 8 chunks per
                bucket.
              </p>
              <p>
                A chunk goes into the bucket that its address points to. Addresses look random, so
                chunks spread across buckets by chance. A few buckets fill before the rest.
              </p>
              <p>
                An upload fails when one bucket is full, even if most of your storage is still
                empty. This is why a storage can show a low &quot;Used&quot; percentage and still
                be close to its limit.
              </p>
              <p>
                The numbers come from this browser&apos;s saved storage state (restored from your
                Swarm backup on other devices), not from the node. Turn on{' '}
                <strong>Advanced mode</strong> in Settings for a better overview: a status line
                (Healthy, Getting full, Almost full, Full) and a chart of how many buckets hold 0,
                1, 2 or more chunks.
              </p>
            </div>
          </details>
          <details className={styles.faqItem}>
            <summary>Storage persistence</summary>
            <div className={styles.faqAnswer}>
              <p>
              Your storage is linked to your wallet address, not to your browser. This means when
              you connect the same wallet to Beeport on a different browser or machine, your
              previously purchased storage will automatically be loaded and available for use. You
              can continue uploading from any device where you connect your wallet.
            </p>
            </div>
          </details>
          <details className={styles.faqItem}>
            <summary>How to prepare archives?</summary>
            <div className={styles.faqAnswer}>
              <p>
                Use &quot;tar -C my_folder -cf my_folder.tar .&quot; command to make your folder
                ready for upload as TAR file. You can also upload ZIP files and GZIP files.
              </p>
            </div>
          </details>
        </div>

        <div className={styles.hotKeyBox}>
          <div className={styles.hotKeyTitle}>Your hot key</div>
          <div className={styles.hint} style={{ marginTop: 0 }}>
            The key that owns your storage on the blockchain. Beeport derives it from your wallet.
            See &quot;What is the hot key?&quot; above.
          </div>
          {hotKeyAddress ? (
            <div className={styles.hotKeyRow}>
              <code className={styles.hotKeyAddress}>{hotKeyAddress}</code>
              <button type="button" className={styles.hotKeyCopy} onClick={copyHotKey}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : (
            <div className={styles.hotKeyEmpty}>
              {walletAddress
                ? 'Not created in this browser yet. Beeport creates it the first time you buy or upload storage. Your wallet signs one message for it.'
                : 'Connect your wallet to see your hot key.'}
            </div>
          )}
          {walletAddress && (
            <div className={styles.hint}>
              Derived from wallet <code className={styles.hotKeyWallet}>{walletAddress}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HelpSection;
