import React, { useState, useEffect, useCallback } from 'react';
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useEnsAddress,
  useEnsResolver,
  useSwitchChain,
} from 'wagmi';
import { parseAbi, namehash, keccak256, toBytes } from 'viem';
import { normalize } from 'viem/ens';
import { mainnet } from 'wagmi/chains';
import { ENS_SUBGRAPH_URL, ENS_SUBGRAPH_API_KEY } from './constants';
import ENSDomainDropdown from './ENSDomainDropdown';
import styles from './css/ENSIntegration.module.css';
import { formatDateEU } from './utils';
import SimpleMarkdown from './SimpleMarkdown';

interface ENSIntegrationProps {
  swarmReference: string;
  onClose: () => void;
}

// ENS contract addresses and ABIs
const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
const ETH_BASE_REGISTRAR_ADDRESS = '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85'; // .eth domain BaseRegistrar (ERC721)
const ETH_REGISTRAR_CONTROLLER_ADDRESS = '0x253553366da8546fc250f225fe3d25d0c782303b'; // Domain registration controller

const ENS_RESOLVER_ABI = parseAbi([
  'function setContenthash(bytes32 node, bytes calldata hash) external',
  'function contenthash(bytes32 node) external view returns (bytes memory)',
]);

const ENS_REGISTRY_ABI = parseAbi([
  'function resolver(bytes32 node) external view returns (address)',
  'function owner(bytes32 node) external view returns (address)',
]);

const ETH_BASE_REGISTRAR_ABI = parseAbi([
  'function ownerOf(uint256 tokenId) external view returns (address)',
]);

const ETH_REGISTRAR_CONTROLLER_ABI = parseAbi([
  'function commit(bytes32 commitment) external',
  'function register(string calldata name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] calldata data, bool reverseRecord, uint16 ownerControlledFuses) external payable',
  'function makeCommitment(string calldata name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] calldata data, bool reverseRecord, uint16 ownerControlledFuses) external pure returns (bytes32)',
  'function rentPrice(string calldata name, uint256 duration) external view returns (uint256)',
  'function available(string calldata name) external view returns (bool)',
  'function commitments(bytes32) external view returns (uint256)',
  'function MIN_COMMITMENT_AGE() external view returns (uint256)',
  'function MAX_COMMITMENT_AGE() external view returns (uint256)',
]);

const NAME_WRAPPER_ADDRESS = '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401';
const ENS_PUBLIC_RESOLVER_ADDRESS = '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63'; // ENS Public Resolver

const NAME_WRAPPER_ABI = parseAbi(['function ownerOf(uint256 id) external view returns (address)']);

// Check if an address can manage a domain (either as owner or controller)
const canManageDomain = async (
  domain: string,
  address: string,
  publicClient: any
): Promise<boolean> => {
  try {
    const normalizedDomain = normalize(domain);
    const domainNode = namehash(normalizedDomain);

    // Check if it's a subdomain
    const isSubdomain = domain.split('.').length > 2;

    if (isSubdomain) {
      console.log('Checking subdomain permissions for:', domain);

      // For subdomains, check registry owner (controller) directly
      const registryOwner = (await publicClient.readContract({
        address: ENS_REGISTRY_ADDRESS,
        abi: ENS_REGISTRY_ABI,
        functionName: 'owner',
        args: [domainNode],
      })) as string;

      console.log('Subdomain registry owner (controller):', registryOwner);

      // If you're the controller of the subdomain, you can manage it
      if (registryOwner.toLowerCase() === address.toLowerCase()) {
        console.log('User is the subdomain controller');
        return true;
      }

      // For subdomains, also check if the parent domain owner can manage
      const parentDomain = domain.split('.').slice(1).join('.');
      console.log('Checking parent domain permissions:', parentDomain);

      const parentNode = namehash(parentDomain);
      const parentOwner = (await publicClient.readContract({
        address: ENS_REGISTRY_ADDRESS,
        abi: ENS_REGISTRY_ABI,
        functionName: 'owner',
        args: [parentNode],
      })) as string;

      console.log('Parent domain owner:', parentOwner);

      // If you own the parent domain, you can typically manage subdomains
      if (parentOwner.toLowerCase() === address.toLowerCase()) {
        console.log('User owns parent domain, can manage subdomain');
        return true;
      }

      // Also check if parent domain is owned via BaseRegistrar (for .eth domains)
      if (parentDomain.endsWith('.eth')) {
        try {
          const parentRegistrant = await getDomainOwner(parentDomain, publicClient);
          if (parentRegistrant.toLowerCase() === address.toLowerCase()) {
            console.log('User is parent domain registrant, can manage subdomain');
            return true;
          }
        } catch (err) {
          console.log('Could not check parent domain registrant:', err);
        }
      }

      console.log('User cannot manage subdomain');
      return false;
    } else {
      // For main domains, use the existing logic
      console.log('Checking main domain permissions for:', domain);

      // Get the actual owner/registrant
      const registrant = await getDomainOwner(domain, publicClient);
      console.log('Final determined registrant:', registrant);

      if (registrant.toLowerCase() === address.toLowerCase()) {
        console.log('User is the registrant/owner');
        return true;
      }

      // Check registry owner as potential controller
      const registryOwner = (await publicClient.readContract({
        address: ENS_REGISTRY_ADDRESS,
        abi: ENS_REGISTRY_ABI,
        functionName: 'owner',
        args: [domainNode],
      })) as string;

      console.log('Registry owner (controller):', registryOwner);

      if (registryOwner.toLowerCase() === address.toLowerCase()) {
        console.log('User is the controller');
        return true;
      }

      // For wrapped names, check if user is approved operator or manager
      if (registryOwner.toLowerCase() === NAME_WRAPPER_ADDRESS.toLowerCase()) {
        // Additional check for NameWrapper permissions
        console.log('Wrapped name - owner check already performed');
      }

      console.log('User is neither owner nor controller');
      return false;
    }
  } catch (err) {
    console.error('Error checking domain management rights:', err);
    return false;
  }
};

// Convert Swarm reference to content hash format (as per ENSIP-7)
const encodeSwarmHash = (swarmReference: string): `0x${string}` => {
  // Remove 0x prefix if present
  const cleanReference = swarmReference.replace(/^0x/, '');

  // Validate hash length - should be 64 hex characters (32 bytes)
  if (cleanReference.length !== 64) {
    throw new Error(
      `Invalid Swarm reference length: ${cleanReference.length} (expected 64 hex chars)`
    );
  }

  // Swarm contenthash format per ENSIP-7:
  // 0xe4 (swarm-ns) + 0x01 (cidv1) + 0xfa (swarm-manifest) + 0x01 (codec) + 0x1b (keccak-256) + 0x20 (32 bytes) + hash
  const swarmPrefix = 'e40101fa011b20';

  const contentHash = `0x${swarmPrefix}${cleanReference}`;

  console.log('Content hash:', contentHash);
  // Validate final length: prefix is 14 chars (7 bytes), + 64 chars hash = 78 chars without 0x, 80 with 0x
  if (contentHash.length !== 80) {
    // including 0x
    throw new Error(`Invalid contenthash length: ${contentHash.length}`);
  }

  return contentHash as `0x${string}`;
};

// Get the actual owner of a domain (handles .eth domains properly, including wrapped names)
const getDomainOwner = async (domain: string, publicClient: any): Promise<string> => {
  const normalizedDomain = normalize(domain);
  const domainNode = namehash(normalizedDomain);

  // Get the owner from ENS Registry
  const registryOwner = (await publicClient.readContract({
    address: ENS_REGISTRY_ADDRESS,
    abi: ENS_REGISTRY_ABI,
    functionName: 'owner',
    args: [domainNode],
  })) as string;

  console.log('Registry owner:', registryOwner);

  // Check if it's wrapped (registry owner is NameWrapper)
  if (registryOwner.toLowerCase() === NAME_WRAPPER_ADDRESS.toLowerCase()) {
    // Convert namehash to uint256 for ownerOf
    const tokenId = BigInt(domainNode); // namehash is bytes32, interpret as uint256

    const wrapperOwner = (await publicClient.readContract({
      address: NAME_WRAPPER_ADDRESS,
      abi: NAME_WRAPPER_ABI,
      functionName: 'ownerOf',
      args: [tokenId],
    })) as string;

    console.log('NameWrapper owner:', wrapperOwner);
    return wrapperOwner;
  }

  // For unwrapped .eth domains
  if (normalizedDomain.endsWith('.eth')) {
    const label = normalizedDomain.replace('.eth', '');
    const labelHash = keccak256(toBytes(label));
    const tokenId = BigInt(labelHash);

    try {
      const baseOwner = (await publicClient.readContract({
        address: ETH_BASE_REGISTRAR_ADDRESS,
        abi: ETH_BASE_REGISTRAR_ABI,
        functionName: 'ownerOf',
        args: [tokenId],
      })) as string;

      console.log('BaseRegistrar owner:', baseOwner);
      return baseOwner;
    } catch (err) {
      console.error('Error getting BaseRegistrar owner:', err);
      throw new Error('Domain not found or not registered');
    }
  }

  // For other domains, return registry owner
  console.log('Using registry owner for non-.eth domain');
  return registryOwner;
};

// Helper function to shorten hash
export const shortenHash = (
  hash: string,
  startLength: number = 6,
  endLength: number = 4
): string => {
  if (!hash) return '';
  if (hash.length <= startLength + endLength) return hash;
  return `${hash.slice(0, startLength)}...${hash.slice(-endLength)}`;
};

const ENSIntegration: React.FC<ENSIntegrationProps> = ({ swarmReference, onClose }) => {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { switchChain } = useSwitchChain();

  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  // Add state for current contenthash
  const [currentContentHash, setCurrentContentHash] = useState<string>('');

  // Add state for content association status
  const [contentAlreadyAssociated, setContentAlreadyAssociated] = useState<boolean>(false);

  // Add state for owned domains
  const [ownedDomains, setOwnedDomains] = useState<string[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(true); // Start as true since we fetch domains on mount
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false); // Track if we've completed initial fetch

  // Add state for domain registration
  const [registrationMode, setRegistrationMode] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [registrationPrice, setRegistrationPrice] = useState<string>('');
  const [commitmentTxHash, setCommitmentTxHash] = useState<string>('');
  const [commitmentTimestamp, setCommitmentTimestamp] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(60); // For waiting period countdown
  const [registrationStep, setRegistrationStep] = useState<
    'input' | 'commit' | 'waiting' | 'register' | 'completed'
  >('input');

  // Function to switch to Ethereum mainnet
  const switchToEthereum = useCallback(async () => {
    if (!switchChain) return false;

    try {
      setIsSwitchingNetwork(true);
      await switchChain({ chainId: mainnet.id });
      console.log('✅ Switched to Ethereum mainnet');
      return true;
    } catch (error) {
      console.error('❌ Failed to switch to Ethereum:', error);
      return false;
    } finally {
      setIsSwitchingNetwork(false);
    }
  }, [switchChain]);

  // Check and switch to Ethereum when component mounts
  useEffect(() => {
    if (address && chainId !== 1) {
      console.log('🔄 ENS requires Ethereum mainnet, switching...');
      switchToEthereum();
    }
  }, [address, chainId, switchToEthereum]);

  // Function to ensure we're on Ethereum before ENS operations
  const ensureEthereumNetwork = async (): Promise<boolean> => {
    if (chainId === 1) {
      return true; // Already on Ethereum
    }

    if (!address) {
      setError('Please connect your wallet first');
      return false;
    }

    setError('Switching to Ethereum mainnet for ENS operations...');
    const switched = await switchToEthereum();

    if (!switched) {
      setError('Please switch to Ethereum mainnet manually to use ENS features');
      return false;
    }

    setError(''); // Clear error after successful switch
    return true;
  };

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

    // Reset registration state when domain changes
    if (registrationMode) {
      setIsAvailable(null);
      setRegistrationPrice('');
      setRegistrationStep('input');
      setCommitmentTxHash('');
      setCommitmentTimestamp(0);
    }
  };

  // Check domain availability for registration
  const checkDomainAvailability = useCallback(
    async (domainName: string) => {
      if (!domainName || !publicClient) return;

      // Only check .eth domains for registration
      if (!domainName.endsWith('.eth')) {
        setIsAvailable(false);
        return;
      }

      setIsCheckingAvailability(true);
      try {
        const name = domainName.replace('.eth', '');
        console.log('🔍 Checking availability for:', name);

        const available = (await publicClient.readContract({
          address: ETH_REGISTRAR_CONTROLLER_ADDRESS,
          abi: ETH_REGISTRAR_CONTROLLER_ABI,
          functionName: 'available',
          args: [name],
        })) as boolean;

        console.log('✅ Domain availability:', available);
        setIsAvailable(available);

        if (available) {
          // Get price for 1 year registration
          const duration = BigInt(365 * 24 * 60 * 60); // 1 year in seconds
          const price = (await publicClient.readContract({
            address: ETH_REGISTRAR_CONTROLLER_ADDRESS,
            abi: ETH_REGISTRAR_CONTROLLER_ABI,
            functionName: 'rentPrice',
            args: [name, duration],
          })) as bigint;

          const priceInEth = (Number(price) / 1e18).toFixed(4);
          setRegistrationPrice(priceInEth);
          console.log('💰 Registration price:', priceInEth, 'ETH');
        } else {
          setRegistrationPrice('');
        }
      } catch (error) {
        console.error('❌ Error checking availability:', error);
        setIsAvailable(null);
      } finally {
        setIsCheckingAvailability(false);
      }
    },
    [publicClient]
  );

  // Handle domain registration process
  const handleDomainRegistration = async () => {
    if (!selectedDomain || !walletClient || !publicClient || !address) {
      setError('Please enter a domain name and connect your wallet');
      return;
    }

    // Ensure we're on Ethereum mainnet
    const isOnEthereum = await ensureEthereumNetwork();
    if (!isOnEthereum) {
      return;
    }

    const domainName = selectedDomain.replace('.eth', '');
    const duration = BigInt(365 * 24 * 60 * 60); // 1 year in seconds
    const secret =
      `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (registrationStep === 'input') {
        console.log('🚀 Starting domain registration - COMMIT phase');
        setRegistrationStep('commit');

        // Step 1: Make commitment following ENS docs
        console.log('📝 Making commitment with parameters:', {
          name: domainName,
          owner: address,
          duration: duration.toString(),
          secret,
          resolver: ENS_PUBLIC_RESOLVER_ADDRESS,
          data: '[]', // Empty bytes array
          reverseRecord: false,
          ownerControlledFuses: 0,
        });

        const commitment = (await publicClient.readContract({
          address: ETH_REGISTRAR_CONTROLLER_ADDRESS,
          abi: ETH_REGISTRAR_CONTROLLER_ABI,
          functionName: 'makeCommitment',
          args: [
            domainName,
            address,
            duration,
            secret,
            ENS_PUBLIC_RESOLVER_ADDRESS, // Use ENS Public Resolver
            [], // Empty bytes array for data
            false, // reverseRecord
            0, // ownerControlledFuses
          ],
        })) as `0x${string}`;

        console.log('✅ Generated commitment hash:', commitment);

        // Submit commitment transaction
        const { request } = await publicClient.simulateContract({
          address: ETH_REGISTRAR_CONTROLLER_ADDRESS,
          abi: ETH_REGISTRAR_CONTROLLER_ABI,
          functionName: 'commit',
          args: [commitment],
          account: address,
        });

        const commitHash = await walletClient.writeContract(request);
        console.log('✅ Commitment transaction hash:', commitHash);

        setCommitmentTxHash(commitHash);
        setTxHash(commitHash);
        setSuccess('Commitment submitted! Waiting for confirmation...');

        // Wait for transaction confirmation
        await publicClient.waitForTransactionReceipt({ hash: commitHash });
        console.log('✅ Commitment confirmed');

        // Store commitment data for registration step
        setCommitmentTimestamp(Date.now());
        setRegistrationStep('waiting');
        setSuccess(`✅ Step 1/2 Complete: Commitment confirmed!

⏱️ Please wait 60 seconds before completing registration.

This waiting period is required by ENS to prevent front-running attacks where someone could see your registration attempt and register the domain before you.`);

        // Store secret temporarily (in production, this should be more secure)
        sessionStorage.setItem(`ens_secret_${domainName}`, secret);
      } else if (registrationStep === 'waiting') {
        console.log('🚀 Starting domain registration - REGISTER phase');
        setRegistrationStep('register');

        // Get stored secret
        const storedSecret = sessionStorage.getItem(`ens_secret_${domainName}`);
        if (!storedSecret) {
          throw new Error('Registration secret not found. Please start over.');
        }

        // Get registration price
        const price = (await publicClient.readContract({
          address: ETH_REGISTRAR_CONTROLLER_ADDRESS,
          abi: ETH_REGISTRAR_CONTROLLER_ABI,
          functionName: 'rentPrice',
          args: [domainName, duration],
        })) as bigint;

        console.log('💰 Registration price:', price.toString(), 'wei');

        // Step 2: Complete registration following ENS docs
        console.log('📝 Registering with parameters:', {
          name: domainName,
          owner: address,
          duration: duration.toString(),
          secret: storedSecret,
          resolver: ENS_PUBLIC_RESOLVER_ADDRESS,
          data: '[]', // Empty bytes array
          reverseRecord: false,
          ownerControlledFuses: 0,
          value: price.toString(),
        });

        const { request } = await publicClient.simulateContract({
          address: ETH_REGISTRAR_CONTROLLER_ADDRESS,
          abi: ETH_REGISTRAR_CONTROLLER_ABI,
          functionName: 'register',
          args: [
            domainName,
            address,
            duration,
            storedSecret as `0x${string}`,
            ENS_PUBLIC_RESOLVER_ADDRESS, // Use ENS Public Resolver
            [], // Empty bytes array for data
            false, // reverseRecord
            0, // ownerControlledFuses
          ],
          account: address,
          value: price,
        });

        const registerHash = await walletClient.writeContract(request);
        console.log('✅ Registration transaction hash:', registerHash);

        setTxHash(registerHash);
        setSuccess('Registration submitted! Waiting for confirmation...');

        // Wait for transaction confirmation
        await publicClient.waitForTransactionReceipt({ hash: registerHash });
        console.log('✅ Registration confirmed');

        // Clean up stored secret
        sessionStorage.removeItem(`ens_secret_${domainName}`);

        // Store the newly registered domain
        // storeRecentDomain(selectedDomain, address); // Removed sessionStorage

        setRegistrationStep('completed');
        setSuccess(`🎉 Registration Complete! Welcome to ${selectedDomain}!

Your new ENS domain is now registered and ready to use:

✅ **Domain**: ${selectedDomain}
✅ **Duration**: 1 year (expires ${formatDateEU(Date.now() + 365 * 24 * 60 * 60 * 1000)})
✅ **Resolver**: ENS Public Resolver
✅ **Owner**: ${address}

**What you can do now:**
• Receive crypto payments at ${selectedDomain}
• Set up a decentralized website
• Use it as your web3 identity across dApps
• Set records (email, website, social profiles)

💡 **Tip**: Switch to "Set Content Hash" mode to link this domain to your Swarm content!
`);

        // Refresh the domain list to include the newly registered domain
        if (address) {
          // Add a delay to ensure the domain shows up in the subgraph
          setTimeout(() => {
            refreshDomainList();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('❌ Registration error:', error);
      let errorMessage = 'Registration failed';

      if (error instanceof Error) {
        if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was cancelled by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient ETH to complete registration';
        } else {
          errorMessage = `Registration failed: ${error.message}`;
        }
      }

      setError(errorMessage);

      // Reset on error
      if (registrationStep === 'commit') {
        setRegistrationStep('input');
      } else if (registrationStep === 'register') {
        setRegistrationStep('waiting');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Check if we're on the right chain
  // const isWrongChain = chainId !== 1; // Removed, using chainId !== 1 directly

  // Check domain availability when in registration mode and domain changes
  useEffect(() => {
    if (registrationMode && selectedDomain) {
      const timeoutId = setTimeout(() => {
        checkDomainAvailability(selectedDomain);
      }, 500); // Debounce to avoid too many requests

      return () => clearTimeout(timeoutId);
    }
  }, [selectedDomain, registrationMode, checkDomainAvailability]);

  // Handle waiting period countdown
  useEffect(() => {
    if (registrationStep === 'waiting' && commitmentTimestamp > 0) {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - commitmentTimestamp;
        const waitTime = 60 * 1000; // 60 seconds

        if (elapsed >= waitTime) {
          clearInterval(interval);
          setSuccess(
            `✅ Waiting period complete! You can now complete your registration for ${selectedDomain}`
          );
        } else {
          const remaining = Math.ceil((waitTime - elapsed) / 1000);
          setRemainingSeconds(remaining);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [registrationStep, commitmentTimestamp, selectedDomain]);

  // Fetch owned domains function
  const fetchOwnedDomains = useCallback(async () => {
    if (!address || !publicClient) {
      setIsLoadingDomains(false);
      setHasAttemptedFetch(true);
      return;
    }

    setIsLoadingDomains(true);
    try {
      console.log('Fetching all manageable domains for address:', address);

      // Step 1: Get domains owned by the user (using official ENS subgraph example)
      const getDomainsQuery = `
        query getDomainsForAccount($address: String!) {
          domains(where: { owner: $address }) {
            name
          }
          wrappedDomains: domains(where: { wrappedOwner: $address }) {
            name
          }
        }
      `;

      console.log('Querying ENS subgraph for owned domains...');
      const domainsResponse = await fetch(ENS_SUBGRAPH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ENS_SUBGRAPH_API_KEY}`,
        },
        body: JSON.stringify({
          query: getDomainsQuery,
          variables: { address: address.toLowerCase() },
        }),
      });

      const allDomains: string[] = [];

      if (domainsResponse.ok) {
        const domainsData = await domainsResponse.json();
        console.log('Domains response:', domainsData);

        // Extract regular domains
        if (domainsData.data?.domains) {
          const ownedDomains = domainsData.data.domains
            .map((domain: any) => domain.name)
            .filter((name: string) => {
              // Basic validation
              if (!name || !name.includes('.')) return false;

              // Exclude reverse DNS entries
              if (name.includes('.addr.reverse')) return false;

              // Exclude domains with hex-like patterns
              if (name.match(/^\[[\da-f]+\]\./)) return false;

              return true;
            });

          console.log('Regular owned domains found:', ownedDomains);
          allDomains.push(...ownedDomains);
        }

        // Extract wrapped domains
        if (domainsData.data?.wrappedDomains) {
          const wrappedDomains = domainsData.data.wrappedDomains
            .map((domain: any) => domain.name)
            .filter((name: string) => {
              // Basic validation
              if (!name || !name.includes('.')) return false;

              // Exclude reverse DNS entries
              if (name.includes('.addr.reverse')) return false;

              // Exclude domains with hex-like patterns
              if (name.match(/^\[[\da-f]+\]\./)) return false;

              return true;
            });

          console.log('Wrapped domains found:', wrappedDomains);
          allDomains.push(...wrappedDomains);
        }

        // Step 2: For each owned domain, get its subdomains (using official ENS pattern)
        for (const domain of allDomains) {
          const getSubDomainsQuery = `
            query getSubDomains($domain: String!) {
              domains(where: { name: $domain }) {
                name
                id
                subdomains(first: 100) {
                  name
                }
                subdomainCount
              }
            }
          `;

          try {
            console.log(`Fetching subdomains for ${domain}...`);
            const subdomainsResponse = await fetch(ENS_SUBGRAPH_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${ENS_SUBGRAPH_API_KEY}`,
              },
              body: JSON.stringify({
                query: getSubDomainsQuery,
                variables: { domain: domain },
              }),
            });

            if (subdomainsResponse.ok) {
              const subdomainsData = await subdomainsResponse.json();
              console.log(`Subdomains response for ${domain}:`, subdomainsData);

              if (subdomainsData.data?.domains?.[0]?.subdomains) {
                const subdomains = subdomainsData.data.domains[0].subdomains
                  .filter((subdomain: any) => {
                    const name = subdomain.name;
                    const userAddress = address.toLowerCase();

                    // Basic validation
                    if (!name || !name.includes('.')) return false;

                    // Exclude reverse DNS entries
                    if (name.includes('.addr.reverse')) return false;

                    // Check if user has management rights over the subdomain
                    const hasOwnership =
                      subdomain.owner?.id?.toLowerCase() === userAddress ||
                      subdomain.registrant?.id?.toLowerCase() === userAddress ||
                      subdomain.wrappedOwner?.id?.toLowerCase() === userAddress;

                    return hasOwnership;
                  })
                  .map((subdomain: any) => subdomain.name);

                console.log(`Subdomains found for ${domain}:`, subdomains);
                allDomains.push(...subdomains);
              }
            }
          } catch (err) {
            console.error(`Error fetching subdomains for ${domain}:`, err);
          }
        }
      } else {
        console.log('ENS subgraph query failed');
      }

      // Remove duplicates and filter valid domains
      const validDomains = allDomains.filter(
        domain =>
          domain &&
          !domain.startsWith('ENS Token #') &&
          !domain.startsWith('Wrapped Token #') &&
          domain.includes('.') &&
          domain.length > 0 &&
          !domain.includes('.addr.reverse') && // Exclude reverse DNS entries
          !domain.match(/^\[[\da-f]+\]\./) && // Exclude hex-pattern domains
          domain.split('.').length >= 2 && // Must have at least one dot (e.g., name.eth)
          domain.length < 100 // Reasonable length limit
      );

      // Remove duplicates and sort
      const uniqueDomains = [...new Set(validDomains)].sort();

      console.log('All domains found:', allDomains);
      console.log('Valid domains:', validDomains);
      console.log('Final unique domains:', uniqueDomains);

      // Get recently registered domains from sessionStorage
      // const recentDomains = getRecentDomains(address); // Removed sessionStorage
      // console.log('Recently registered domains:', recentDomains);

      // Merge with subgraph results
      const allDomainsWithRecent = [...uniqueDomains]; // Removed recentDomains
      const finalUniqueDomains = [...new Set(allDomainsWithRecent)].sort();

      console.log(`📊 Final domain list:`, {
        fromSubgraph: uniqueDomains.length,
        // fromRecent: recentDomains.length, // Removed recentDomains
        totalUnique: finalUniqueDomains.length,
        domains: finalUniqueDomains,
      });

      setOwnedDomains(finalUniqueDomains);
    } catch (err) {
      console.error('Error fetching owned domains:', err);
      setOwnedDomains([]);
    } finally {
      setIsLoadingDomains(false);
      setHasAttemptedFetch(true);
    }
  }, [address, publicClient]);

  // Function to refresh just the domain list (for after registration)
  const refreshDomainList = async () => {
    console.log('🔄 Refreshing domain list after registration...');
    await fetchOwnedDomains();
  };

  // Function to save reference with associated domain
  const saveReferenceWithDomain = useCallback(
    (reference: string, domain: string) => {
      if (!address) return;

      const savedHistory = localStorage.getItem('uploadHistory');
      const history = savedHistory ? JSON.parse(savedHistory) : {};
      const addressHistory = history[address] || [];

      // Find existing record with this reference
      const existingRecord = addressHistory.find((record: any) => record.reference === reference);

      if (existingRecord) {
        // Check if domain is already associated
        if (!existingRecord.associatedDomains) {
          existingRecord.associatedDomains = [];
        }

        if (!existingRecord.associatedDomains.includes(domain)) {
          existingRecord.associatedDomains.push(domain);

          // Save updated history
          history[address] = addressHistory;
          localStorage.setItem('uploadHistory', JSON.stringify(history));

          console.log(`Added domain ${domain} to existing reference ${reference}`);
        }
      } else {
        // Create new record if reference doesn't exist
        const newRecord = {
          reference,
          timestamp: Date.now(),
          filename: `ENS-linked content for ${domain}`,
          stampId: 'unknown', // We don't have stamp info for existing content
          expiryDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // Default 30 days
          associatedDomains: [domain],
        };

        addressHistory.unshift(newRecord);
        history[address] = addressHistory;
        localStorage.setItem('uploadHistory', JSON.stringify(history));

        console.log(`Created new history record for reference ${reference} with domain ${domain}`);
      }
    },
    [address]
  );

  // Add useEffect to fetch owned domains when wallet is connected
  useEffect(() => {
    fetchOwnedDomains();
  }, [fetchOwnedDomains]);

  // Add useEffect to fetch contenthash when domain is validated
  useEffect(() => {
    const fetchCurrentContentHash = async () => {
      if (!selectedDomain || !ensResolver || !publicClient) return;

      try {
        const normalizedDomain = normalize(selectedDomain);
        const domainNode = namehash(normalizedDomain);

        const contentHashBytes = (await publicClient.readContract({
          address: ensResolver as `0x${string}`,
          abi: ENS_RESOLVER_ABI,
          functionName: 'contenthash',
          args: [domainNode],
        })) as `0x${string}`;

        if (contentHashBytes === '0x') {
          setCurrentContentHash('No content hash set');
          setContentAlreadyAssociated(false);
          return;
        }

        // Check if it's a Swarm hash (starts with e40101fa011b20)
        const cleanHash = contentHashBytes.replace('0x', '').toLowerCase();
        if (cleanHash.startsWith('e40101fa011b20')) {
          // Extract the 32-byte hash (last 64 hex chars)
          const swarmRef = cleanHash.slice(14);
          setCurrentContentHash(`Swarm: bzz://${shortenHash(swarmRef)}`);

          // Check if this matches the current swarmReference being set
          const cleanSwarmReference = swarmReference.replace(/^0x/, '').toLowerCase();
          if (swarmRef === cleanSwarmReference && address) {
            setContentAlreadyAssociated(true);
            // Save to history if not already saved with this domain
            saveReferenceWithDomain(swarmReference, selectedDomain);
          } else {
            setContentAlreadyAssociated(false);
          }
        } else {
          // For other types, display the full hex
          setCurrentContentHash(`Content Hash: ${shortenHash(contentHashBytes, 6, 6)}`);
          setContentAlreadyAssociated(false);
        }
      } catch (err) {
        console.error('Error fetching current contenthash:', err);
        setCurrentContentHash('Error fetching content hash');
        setContentAlreadyAssociated(false);
      }
    };

    if (ensAddress && !ensAddressLoading && !ensAddressError) {
      fetchCurrentContentHash();
    } else {
      setCurrentContentHash('');
      setContentAlreadyAssociated(false);
    }
  }, [
    selectedDomain,
    ensResolver,
    publicClient,
    ensAddress,
    ensAddressLoading,
    ensAddressError,
    swarmReference,
    address,
    saveReferenceWithDomain,
  ]);

  const handleSetContentHash = async () => {
    console.log('🚀 Starting handleSetContentHash for domain:', selectedDomain);
    console.log('📊 Initial state:', {
      selectedDomain,
      walletClient: !!walletClient,
      publicClient: !!publicClient,
      chainId,
      ensResolver,
      ensResolverError,
      ensAddress,
      ensAddressError,
      ownedDomains,
    });

    if (!selectedDomain || !walletClient || !publicClient) {
      console.log('❌ Missing required parameters');
      setError('Please enter a domain name and connect your wallet');
      return;
    }

    // Ensure we're on Ethereum mainnet
    const isOnEthereum = await ensureEthereumNetwork();
    if (!isOnEthereum) {
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
        console.log('✅ Domain normalized:', normalizedDomain);
      } catch (err) {
        console.log('❌ Domain normalization failed:', err);
        setError('Invalid domain name. Please enter a valid ENS domain (e.g., myname.eth)');
        setIsLoading(false);
        return;
      }

      // Check if domain exists and is manageable
      const isOwnedDomain = ownedDomains.includes(normalizedDomain);
      const hasResolver = ensResolver && !ensResolverError;
      const hasAddress = ensAddress && !ensAddressError;

      console.log('🔍 Domain validation checks:', {
        isOwnedDomain,
        hasResolver,
        hasAddress,
        ensResolver,
        ensResolverError,
        ensAddress,
        ensAddressError,
      });

      // Domain is valid if it's in our owned list, has a resolver, or has an address
      if (!isOwnedDomain && !hasResolver && !hasAddress) {
        console.log('❌ Domain validation failed - domain not found or manageable');
        setError(
          `Domain "${normalizedDomain}" is not registered or configured in ENS. Please check the domain name or register it at app.ens.domains.`
        );
        setIsLoading(false);
        return;
      }

      console.log('✅ Domain validation passed');

      console.log('📍 Domain resolution info:', {
        ensAddress,
        ensResolver,
        resolverNonZero: ensResolver !== '0x0000000000000000000000000000000000000000',
      });

      // Get domain node for contract calls
      const domainNode = namehash(normalizedDomain);

      console.log('🎯 Domain metadata:', {
        normalizedDomain,
        domainNode,
        swarmReference,
        isSubdomain: normalizedDomain.split('.').length > 2,
      });

      // Check if the user can manage the domain (either as registrant or controller)
      console.log('🔐 Starting permission check for:', {
        domain: normalizedDomain,
        type: normalizedDomain.endsWith('.eth') ? '.eth domain' : 'other domain',
        connectedAddress: address,
        isSubdomain: normalizedDomain.split('.').length > 2,
      });

      const canManage = await canManageDomain(normalizedDomain, address!, publicClient);

      console.log('🔐 Permission check result:', { canManage });

      if (!canManage) {
        console.log('❌ Permission check failed, getting owner info...');
        // Get the actual owner info for error message
        try {
          const domainOwner = await getDomainOwner(normalizedDomain, publicClient);
          console.log('📋 Domain owner info:', domainOwner);
          setError(
            `You do not have permission to manage "${normalizedDomain}". The domain registrant is: ${domainOwner}`
          );
        } catch (err) {
          console.log('❌ Error getting domain owner:', err);
          setError(
            `Unable to verify ownership of "${normalizedDomain}". ${err instanceof Error ? err.message : "Please ensure you're connected to Ethereum mainnet."}`
          );
        }
        setIsLoading(false);
        return;
      }

      console.log('✅ User has permission to manage the domain');

      // Double-check resolver directly from ENS Registry (bypasses cache)
      let resolverAddress: `0x${string}` | undefined = ensResolver as `0x${string}` | undefined;
      try {
        console.log('🔍 Double-checking resolver from ENS Registry...');
        const registryResolverAddress = (await publicClient.readContract({
          address: ENS_REGISTRY_ADDRESS,
          abi: ENS_REGISTRY_ABI,
          functionName: 'resolver',
          args: [domainNode],
        })) as `0x${string}`;

        if (
          registryResolverAddress &&
          registryResolverAddress !== '0x0000000000000000000000000000000000000000'
        ) {
          resolverAddress = registryResolverAddress;
          console.log('✅ Resolver confirmed from registry:', resolverAddress);
        }
      } catch (registryError) {
        console.log('⚠️ Could not verify resolver from registry:', registryError);
      }

      // Check if domain has a resolver
      if (!resolverAddress || resolverAddress === '0x0000000000000000000000000000000000000000') {
        console.log('❌ No resolver set for domain');
        setError(
          `Domain "${normalizedDomain}" has no resolver set. Please set a resolver first using the ENS manager at app.ens.domains.`
        );
        setIsLoading(false);
        return;
      }

      console.log('✅ Resolver found:', resolverAddress);

      // Verify the resolver is ready by trying to read from it first
      console.log('🔍 Verifying resolver is ready...');
      try {
        const currentContentHash = await publicClient.readContract({
          address: resolverAddress as `0x${string}`,
          abi: ENS_RESOLVER_ABI,
          functionName: 'contenthash',
          args: [domainNode],
        });
        console.log('✅ Resolver is ready, current contenthash:', currentContentHash);
      } catch (readError) {
        console.log('⚠️ Resolver read failed, might not be ready yet:', readError);
        setError(
          `The resolver for "${normalizedDomain}" is not ready yet. This can happen immediately after domain registration. Please wait 1-2 minutes and try again, or refresh the page.`
        );
        setIsLoading(false);
        return;
      }

      // Encode the Swarm reference as content hash
      const contentHash = encodeSwarmHash(swarmReference);
      console.log('Encoded content hash:', contentHash);

      // Prepare the transaction to set content hash
      console.log('🔄 Simulating setContenthash transaction...');
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

      // Save the domain association to history
      if (address) {
        saveReferenceWithDomain(swarmReference, normalizedDomain);
      }

      setSuccess(`Successfully set content hash for ${normalizedDomain}!

Your domain now points to: bzz://${shortenHash(swarmReference)}

You can now access your content at:
• [${normalizedDomain}](https://${normalizedDomain}.limo) (in ENS-compatible browsers)
• [${normalizedDomain}.limo](https://${normalizedDomain}.limo) (via ENS gateway)
• [${normalizedDomain}.link](https://${normalizedDomain}.link) (via ENS gateway)`);
    } catch (err) {
      console.error('Error setting content hash:', err);
      let errorMessage = 'Failed to set content hash';

      if (err instanceof Error) {
        if (err.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds to pay for the transaction';
        } else if (err.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected by user';
        } else if (err.message.includes('execution reverted') || err.message.includes('reverted')) {
          errorMessage =
            'Transaction simulation failed. This often happens immediately after domain registration. ' +
            'Please wait 1-2 minutes for the resolver to be fully ready, or refresh the page and try again.';
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

    // Check if domain is in our owned domains list (most reliable for subdomains)
    const isOwnedDomain = ownedDomains.includes(selectedDomain);

    // For owned domains, we know they exist and are manageable
    if (isOwnedDomain) {
      return <div className={styles.validationSuccess}>✅ Domain found</div>;
    }

    // For manual entry, check if it has a resolver (domains without address records can still have resolvers)
    if (ensResolver && !ensResolverError) {
      return <div className={styles.validationSuccess}>✅ Domain found</div>;
    }

    // Check if it has an address record (traditional validation)
    if (ensAddress && !ensAddressError) {
      return <div className={styles.validationSuccess}>✅ Domain found</div>;
    }

    // Only show error if we've confirmed it doesn't exist
    if (ensAddressError && ensResolverError) {
      return <div className={styles.validationError}>❌ Domain not found</div>;
    }

    // Still loading resolver info, show spinner
    return (
      <div className={styles.validating}>
        <div className={styles.spinner}></div>
      </div>
    );
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
          {chainId !== 1 && (
            <div className={styles.chainWarning}>
              <strong>⚠️ Wrong Network:</strong> ENS requires Ethereum Mainnet.
              {isSwitchingNetwork ? (
                <span> 🔄 Switching to Ethereum...</span>
              ) : (
                <span> Please switch to Ethereum Mainnet to use ENS features.</span>
              )}
            </div>
          )}

          <div className={styles.referenceInfo}>
            <h3>Swarm Reference</h3>
            <code className={styles.reference}>{swarmReference}</code>
            {contentAlreadyAssociated ? (
              <p>✅ This content hash is already associated with {selectedDomain}</p>
            ) : (
              <p>This will be set as the content hash for your selected domain.</p>
            )}
          </div>

          {/* Mode Toggle */}
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeButton} ${!registrationMode ? styles.active : ''}`}
              onClick={() => {
                setRegistrationMode(false);
                setError('');
                setSuccess('');
                setRegistrationStep('input');
              }}
              disabled={isLoading}
            >
              Set Content Hash
            </button>
            <button
              className={`${styles.modeButton} ${registrationMode ? styles.active : ''}`}
              onClick={() => {
                setRegistrationMode(true);
                setError('');
                setSuccess('');
                setRegistrationStep('input');
              }}
              disabled={isLoading}
            >
              Register Domain
            </button>
          </div>

          <div className={styles.domainSection}>
            <h3>{registrationMode ? 'Register New ENS Domain' : 'Select Your ENS Domain'}</h3>

            <div className={styles.domainInput}>
              <label htmlFor="domain">
                {registrationMode ? 'New Domain Name:' : 'Domain Name:'}
              </label>
              <div className={styles.inputContainer}>
                {registrationMode ? (
                  // Registration mode: Always show input field
                  <input
                    id="domain"
                    type="text"
                    value={selectedDomain}
                    onChange={e => handleDomainChange(e.target.value)}
                    placeholder="mynewdomain.eth"
                    className={styles.input}
                    disabled={isLoading}
                  />
                ) : isLoadingDomains ? (
                  // Show loading state while fetching domains
                  <ENSDomainDropdown
                    domains={[]}
                    selectedDomain={selectedDomain}
                    onDomainSelect={handleDomainChange}
                    isLoading={true}
                    disabled={isLoading}
                    placeholder="🔍 Searching for your ENS domains..."
                  />
                ) : ownedDomains.length > 0 ? (
                  // Show dropdown if domains were found
                  <ENSDomainDropdown
                    domains={ownedDomains}
                    selectedDomain={selectedDomain}
                    onDomainSelect={handleDomainChange}
                    disabled={isLoading}
                    placeholder="Select a domain..."
                  />
                ) : (
                  // Show input field if no domains were found
                  <input
                    id="domain"
                    type="text"
                    value={selectedDomain}
                    onChange={e => handleDomainChange(e.target.value)}
                    placeholder="myname.eth"
                    className={styles.input}
                    disabled={isLoading}
                  />
                )}
                {!registrationMode && !isLoadingDomains && getValidationStatus()}
              </div>

              {/* Domain availability status for registration mode */}
              {registrationMode && selectedDomain && (
                <div className={styles.availabilityStatus}>
                  {isCheckingAvailability ? (
                    <div className={styles.checking}>
                      <div className={styles.spinner}></div>
                      Checking availability...
                    </div>
                  ) : isAvailable === true ? (
                    <div className={styles.available}>
                      ✅ {selectedDomain} is available!
                      {registrationPrice && (
                        <span className={styles.price}>
                          Registration: {registrationPrice} ETH/year
                        </span>
                      )}
                    </div>
                  ) : isAvailable === false ? (
                    selectedDomain.endsWith('.eth') ? (
                      <div className={styles.unavailable}>❌ {selectedDomain} is not available</div>
                    ) : (
                      <div className={styles.unavailable}>
                        ❌ {selectedDomain} must end with .eth
                      </div>
                    )
                  ) : null}
                </div>
              )}
              {!registrationMode && !isLoadingDomains && (
                <div className={styles.hint}>
                  {ownedDomains.length > 0
                    ? `Found ${ownedDomains.length} domain(s). Select one from the dropdown above.`
                    : 'Enter your ENS domain name (e.g., myname.eth, myname.xyz)'}
                </div>
              )}
              {!registrationMode &&
                !isLoadingDomains &&
                hasAttemptedFetch &&
                ownedDomains.length === 0 && (
                  <div className={styles.noDomains}>
                    No ENS domains found for your wallet. You can still enter a domain manually
                    above.
                  </div>
                )}
              {registrationMode && (
                <div className={styles.hint}>
                  Enter a new .eth domain name to register (e.g., mynewdomain.eth)
                </div>
              )}
              {ensAddress && (
                <div className={styles.domainInfo}>
                  ✅ Domain resolves to: {ensAddress.slice(0, 10)}...{ensAddress.slice(-8)}
                </div>
              )}
              {currentContentHash && (
                <div className={styles.currentContentHash}>
                  <strong>Current Content:</strong> {currentContentHash}
                </div>
              )}
              <div className={styles.domainHelp}>
                <p>
                  Don&apos;t have an ENS domain? Use the &quot;Register Domain&quot; button below to
                  get started, or{' '}
                  <a href="https://app.ens.domains" target="_blank" rel="noopener noreferrer">
                    visit app.ens.domains
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
              <strong>Success!</strong> <SimpleMarkdown>{success}</SimpleMarkdown>
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
                {shortenHash(txHash, 6, 6)}
              </a>
            </div>
          )}

          <div className={styles.actions}>
            {registrationMode ? (
              <>
                <button
                  className={styles.setButton}
                  onClick={handleDomainRegistration}
                  disabled={
                    !selectedDomain ||
                    isLoading ||
                    chainId !== 1 ||
                    isSwitchingNetwork ||
                    isAvailable !== true ||
                    (registrationStep === 'waiting' &&
                      commitmentTimestamp > 0 &&
                      Date.now() - commitmentTimestamp < 60000)
                  }
                >
                  {isLoading ? (
                    <>
                      <div className={styles.spinner}></div>
                      {registrationStep === 'commit' && 'Committing...'}
                      {registrationStep === 'register' && 'Registering...'}
                    </>
                  ) : isSwitchingNetwork ? (
                    'Switching to Ethereum...'
                  ) : registrationStep === 'input' ? (
                    'Start Registration'
                  ) : registrationStep === 'waiting' ? (
                    commitmentTimestamp > 0 && Date.now() - commitmentTimestamp < 60000 ? (
                      `Wait ${Math.ceil((60000 - (Date.now() - commitmentTimestamp)) / 1000)}s`
                    ) : (
                      'Complete Registration'
                    )
                  ) : registrationStep === 'completed' ? (
                    'Registration Complete'
                  ) : (
                    'Register Domain'
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  className={styles.setButton}
                  onClick={handleSetContentHash}
                  disabled={
                    !selectedDomain ||
                    isLoading ||
                    ensAddressLoading ||
                    chainId !== 1 ||
                    isSwitchingNetwork ||
                    contentAlreadyAssociated || // Disable if content is already associated
                    // For domain validation, check if it's owned, has resolver, or has address
                    (!ownedDomains.includes(selectedDomain) &&
                      (!ensResolver || ensResolverError) &&
                      (!ensAddress || ensAddressError))
                  }
                >
                  {isLoading ? (
                    <>
                      <div className={styles.spinner}></div>
                      Setting Content Hash...
                    </>
                  ) : isSwitchingNetwork ? (
                    'Switching to Ethereum...'
                  ) : contentAlreadyAssociated ? (
                    'Content Already Associated'
                  ) : (
                    'Set Content Hash'
                  )}
                </button>
              </>
            )}
            <button className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
          </div>

          <div className={styles.info}>
            <ul>
              <li>Your ENS domain will point to Swarm content (bzz://)</li>
              <li>
                Setting the content hash requires ETH (gas fees) and connection to Ethereum Mainnet
              </li>
              <li>You must own the domain</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ENSIntegration;
