import React, { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient, useEnsAddress, useEnsResolver } from 'wagmi';
import { parseAbi, namehash } from 'viem';
import { normalize } from 'viem/ens';
import styles from './css/ENSIntegration.module.css';

interface ENSIntegrationProps {
  swarmReference: string;
  onClose: () => void;
}

// ENS contract addresses and ABIs
const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

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
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  // Use wagmi hooks to resolve ENS data - these will return null if domain doesn't exist
  const {
    data: ensAddress,
    isError: ensAddressError,
    isLoading: ensAddressLoading,
  } = useEnsAddress({
    name: selectedDomain || undefined,
    chainId: 1, // Always use Ethereum mainnet for ENS
  });

  const { data: ensResolver, isError: ensResolverError } = useEnsResolver({
    name: selectedDomain || undefined,
    chainId: 1, // Always use Ethereum mainnet for ENS
  });

  const handleDomainChange = (domain: string) => {
    setSelectedDomain(domain);
    setError('');
  };

  // Check if we're on the right chain
  const isWrongChain = chainId !== 1;

  const handleSetContentHash = async () => {
    if (!selectedDomain || !walletClient || !publicClient) {
      setError('Please enter a domain name and connect your wallet');
      return;
    }

    // Check if we're on Ethereum mainnet
    if (isWrongChain) {
      setError(
        'Please switch to Ethereum Mainnet to set ENS content hash. ENS records are stored on Ethereum mainnet.'
      );
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    setTxHash('');

    try {
      // Normalize the domain name
      let normalizedDomain: string;
      try {
        normalizedDomain = normalize(selectedDomain);
      } catch (err) {
        setError('Invalid domain name. Please enter a valid ENS domain (e.g., myname.eth)');
        setIsLoading(false);
        return;
      }

      // Check if domain resolves to an address (indicates it exists and is configured)
      if (ensAddressError || !ensAddress) {
        setError(
          `Domain "${normalizedDomain}" is not registered or configured in ENS. Please check the domain name or register it at app.ens.domains.`
        );
        setIsLoading(false);
        return;
      }

      console.log('Domain resolves to address:', ensAddress);
      console.log('ENS Resolver:', ensResolver);

      // Get domain node for contract calls
      const domainNode = namehash(normalizedDomain);

      console.log('Setting content hash for domain:', normalizedDomain);
      console.log('Domain node:', domainNode);
      console.log('Swarm reference:', swarmReference);

      // Get the owner of the domain directly using registry
      let domainOwner: string;
      try {
        domainOwner = (await publicClient.readContract({
          address: ENS_REGISTRY_ADDRESS,
          abi: ENS_REGISTRY_ABI,
          functionName: 'owner',
          args: [domainNode],
        })) as string;
      } catch (err) {
        console.error('Error getting domain owner:', err);
        setError(
          `Unable to verify ownership of "${normalizedDomain}". Please ensure you're connected to Ethereum mainnet.`
        );
        setIsLoading(false);
        return;
      }

      console.log('Domain owner:', domainOwner);
      console.log('Current address:', address);

      if (!domainOwner || domainOwner === '0x0000000000000000000000000000000000000000') {
        setError(
          `Domain "${normalizedDomain}" has no owner. The domain may have expired or not be properly registered.`
        );
        setIsLoading(false);
        return;
      }

      if (domainOwner.toLowerCase() !== address?.toLowerCase()) {
        setError(
          `You do not own the domain "${normalizedDomain}". Current owner: ${domainOwner.slice(0, 10)}...${domainOwner.slice(-8)}`
        );
        setIsLoading(false);
        return;
      }

      // Check if domain has a resolver
      if (!ensResolver || ensResolver === '0x0000000000000000000000000000000000000000') {
        setError(
          `Domain "${normalizedDomain}" has no resolver set. Please set a resolver first using the ENS manager at app.ens.domains.`
        );
        setIsLoading(false);
        return;
      }

      console.log('Using resolver:', ensResolver);

      // Encode the Swarm reference as content hash
      const contentHash = encodeSwarmHash(swarmReference);
      console.log('Encoded content hash:', contentHash);

      // Prepare the transaction to set content hash
      const { request } = await publicClient.simulateContract({
        address: ensResolver as `0x${string}`,
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
        } else if (err.message.includes('returned no data')) {
          errorMessage =
            'Domain lookup failed. Please verify the domain is properly registered and try again';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show validation status
  const getValidationStatus = () => {
    if (!selectedDomain || !selectedDomain.includes('.')) return null;

    if (ensAddressLoading) {
      return (
        <div className={styles.validating}>
          <div className={styles.spinner}></div>
        </div>
      );
    }

    if (ensAddressError || !ensAddress) {
      return <div className={styles.validationError}>❌ Domain not found</div>;
    }

    return <div className={styles.validationSuccess}>✅ Domain found</div>;
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
          {isWrongChain && (
            <div className={styles.chainWarning}>
              <strong>⚠️ Wrong Network:</strong> Please switch to Ethereum Mainnet to manage ENS
              domains. ENS records are stored on Ethereum mainnet.
            </div>
          )}

          <div className={styles.referenceInfo}>
            <h3>Swarm Reference</h3>
            <code className={styles.reference}>{swarmReference}</code>
            <p>This will be set as the content hash for your selected domain.</p>
          </div>

          <div className={styles.domainSection}>
            <h3>Enter Your ENS Domain</h3>

            <div className={styles.domainInput}>
              <label htmlFor="domain">Domain Name:</label>
              <div className={styles.inputContainer}>
                <input
                  id="domain"
                  type="text"
                  value={selectedDomain}
                  onChange={e => handleDomainChange(e.target.value)}
                  placeholder="myname.eth"
                  className={styles.input}
                />
                {getValidationStatus()}
              </div>
              <div className={styles.hint}>
                Enter your ENS domain name (e.g., myname.eth, myname.xyz)
              </div>
              {ensAddress && (
                <div className={styles.domainInfo}>
                  ✅ Domain resolves to: {ensAddress.slice(0, 10)}...{ensAddress.slice(-8)}
                </div>
              )}
              <div className={styles.domainHelp}>
                <p>
                  Don't have an ENS domain?{' '}
                  <a href="https://app.ens.domains" target="_blank" rel="noopener noreferrer">
                    Register one here
                  </a>
                </p>
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
              disabled={
                !selectedDomain || isLoading || ensAddressLoading || !ensAddress || isWrongChain
              }
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
              <li>You must be connected to Ethereum Mainnet</li>
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
