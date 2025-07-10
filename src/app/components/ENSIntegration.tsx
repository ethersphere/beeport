import React, { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseAbi, namehash } from 'viem';
import { normalize } from 'viem/ens';
import styles from './css/ENSIntegration.module.css';

interface ENSIntegrationProps {
  swarmReference: string;
  onClose: () => void;
}

// ENS contract addresses and ABIs
const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
const ENS_PUBLIC_RESOLVER_ADDRESS = '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41';

const ENS_RESOLVER_ABI = parseAbi([
  'function setContenthash(bytes32 node, bytes calldata hash) external',
  'function contenthash(bytes32 node) external view returns (bytes memory)',
]);

const ENS_REGISTRY_ABI = parseAbi([
  'function resolver(bytes32 node) external view returns (address)',
  'function owner(bytes32 node) external view returns (address)',
]);

// Convert Swarm reference to content hash format
const encodeSwarmHash = (swarmReference: string): `0x${string}` => {
  // Remove 0x prefix if present
  const cleanReference = swarmReference.replace(/^0x/, '');

  // Swarm content hash format: 0xe40101 + 32-byte hash
  // 0xe4 = swarm-ns, 0x01 = swarm hash identifier, 0x01 = 32-byte length
  const swarmPrefix = 'e40101';
  const contentHash = `0x${swarmPrefix}${cleanReference}`;

  return contentHash as `0x${string}`;
};

const ENSIntegration: React.FC<ENSIntegrationProps> = ({ swarmReference, onClose }) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  const handleSetContentHash = async () => {
    if (!selectedDomain || !walletClient || !publicClient) {
      setError('Please enter a domain name and connect your wallet');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    setTxHash('');

    try {
      // Normalize and validate the domain name
      let normalizedDomain: string;
      try {
        normalizedDomain = normalize(selectedDomain);
      } catch (err) {
        setError('Invalid domain name. Please enter a valid ENS domain (e.g., myname.eth)');
        setIsLoading(false);
        return;
      }

      const domainNode = namehash(normalizedDomain);

      console.log('Setting content hash for domain:', normalizedDomain);
      console.log('Domain node:', domainNode);
      console.log('Swarm reference:', swarmReference);

      // Check if user owns this domain
      const domainOwner = await publicClient.readContract({
        address: ENS_REGISTRY_ADDRESS,
        abi: ENS_REGISTRY_ABI,
        functionName: 'owner',
        args: [domainNode],
      });

      if (domainOwner.toLowerCase() !== address?.toLowerCase()) {
        setError(
          `You do not own the domain "${normalizedDomain}". Please make sure you own this domain.`
        );
        setIsLoading(false);
        return;
      }

      // Get the resolver for this domain
      const resolverAddress = await publicClient.readContract({
        address: ENS_REGISTRY_ADDRESS,
        abi: ENS_REGISTRY_ABI,
        functionName: 'resolver',
        args: [domainNode],
      });

      console.log('Resolver address:', resolverAddress);

      if (!resolverAddress || resolverAddress === '0x0000000000000000000000000000000000000000') {
        setError(
          `Domain "${normalizedDomain}" has no resolver set. Please set a resolver first using the ENS manager.`
        );
        setIsLoading(false);
        return;
      }

      // Encode the Swarm reference as content hash
      const contentHash = encodeSwarmHash(swarmReference);
      console.log('Encoded content hash:', contentHash);

      // Prepare the transaction to set content hash
      const { request } = await publicClient.simulateContract({
        address: resolverAddress as `0x${string}`,
        abi: ENS_RESOLVER_ABI,
        functionName: 'setContenthash',
        args: [domainNode, contentHash],
        account: address,
      });

      // Execute the transaction
      const hash = await walletClient.writeContract(request);
      console.log('Transaction hash:', hash);
      setTxHash(hash);

      // Wait for transaction confirmation
      setSuccess('Transaction submitted! Waiting for confirmation...');

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('Transaction confirmed:', receipt);

      setSuccess(`Successfully set content hash for ${normalizedDomain}!

Your domain now points to: bzz://${swarmReference}

You can now access your content at:
• ${normalizedDomain} (in ENS-compatible browsers)
• ${normalizedDomain}.limo (via ENS gateway)
• ${normalizedDomain}.link (via ENS gateway)

Transaction confirmed: ${hash}`);
    } catch (err) {
      console.error('Error setting content hash:', err);
      let errorMessage = 'Failed to set content hash';

      if (err instanceof Error) {
        if (err.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds to pay for the transaction';
        } else if (err.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected by user';
        } else if (err.message.includes('execution reverted')) {
          errorMessage = 'Transaction failed - you may not have permission to modify this domain';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Link ENS Domain to Swarm Content</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.referenceInfo}>
            <h3>Swarm Reference</h3>
            <code className={styles.reference}>{swarmReference}</code>
            <p>This will be set as the content hash for your selected domain.</p>
          </div>

          <div className={styles.domainSection}>
            <h3>Enter Your ENS Domain</h3>

            <div className={styles.domainInput}>
              <label htmlFor="domain">Domain Name:</label>
              <input
                id="domain"
                type="text"
                value={selectedDomain}
                onChange={e => setSelectedDomain(e.target.value)}
                placeholder="myname.eth"
                className={styles.input}
              />
              <div className={styles.hint}>
                Enter your ENS domain name (e.g., myname.eth, myname.xyz)
              </div>
            </div>
          </div>

          {error && (
            <div className={styles.error}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {success && (
            <div className={styles.success}>
              <strong>Success!</strong> {success}
            </div>
          )}

          {txHash && (
            <div className={styles.txInfo}>
              <strong>Transaction Hash:</strong>
              <a
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.txLink}
              >
                {txHash}
              </a>
            </div>
          )}

          <div className={styles.actions}>
            <button
              className={styles.setButton}
              onClick={handleSetContentHash}
              disabled={!selectedDomain || isLoading}
            >
              {isLoading ? (
                <>
                  <div className={styles.spinner}></div>
                  Setting Content Hash...
                </>
              ) : (
                'Set Content Hash'
              )}
            </button>
            <button className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
          </div>

          <div className={styles.info}>
            <h4>How this works:</h4>
            <ul>
              <li>Your ENS domain will point to the Swarm content using the bzz:// protocol</li>
              <li>Users can access your content via ENS-compatible browsers or gateways</li>
              <li>The content hash is stored on Ethereum blockchain (gas fees apply)</li>
              <li>You must own the domain to set its content hash</li>
            </ul>

            <h4>Requirements:</h4>
            <ul>
              <li>You must own the ENS domain</li>
              <li>The domain must have a resolver set</li>
              <li>You need ETH to pay for the transaction</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ENSIntegration;
