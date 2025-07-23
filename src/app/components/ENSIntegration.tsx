import React, { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient, useEnsAddress, useEnsResolver } from 'wagmi';
import { parseAbi, namehash, keccak256, toBytes } from 'viem';
import { normalize } from 'viem/ens';
import { Alchemy, Network } from 'alchemy-sdk';
import { ENS_SUBGRAPH_URL, ENS_SUBGRAPH_API_KEY } from './constants';
import styles from './css/ENSIntegration.module.css';

interface ENSIntegrationProps {
  swarmReference: string;
  onClose: () => void;
}

// ENS contract addresses and ABIs
const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
const ETH_BASE_REGISTRAR_ADDRESS = '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85'; // .eth domain BaseRegistrar (ERC721)

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

const NAME_WRAPPER_ADDRESS = '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401';

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
  let cleanReference = swarmReference.replace(/^0x/, '');

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

// Add this new function to decode ENS token IDs to domain names
const decodeENSName = async (tokenId: string, publicClient: any): Promise<string> => {
  console.log('=== Starting decodeENSName for token ID:', tokenId);

  try {
    // Convert token ID to hex format for labelhash
    const tokenIdBigInt = BigInt(tokenId);
    const labelhash = `0x${tokenIdBigInt.toString(16).padStart(64, '0')}`;

    console.log('Token ID:', tokenId);
    console.log('Labelhash:', labelhash);

    // Simple ENS subgraph query to get domain name
    try {
      const query = `
        query {
          domains(first: 1, where: { labelhash: "${labelhash}" }) {
            name
            labelName
          }
        }
      `;

      console.log('Querying ENS subgraph with labelhash:', labelhash);
      const response = await fetch(ENS_SUBGRAPH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ENS_SUBGRAPH_API_KEY}`,
        },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('ENS subgraph response:', data);

        if (data.data?.domains && data.data.domains.length > 0) {
          const domain = data.data.domains[0];
          if (domain.name) {
            console.log('✅ Found domain name from subgraph:', domain.name);
            return domain.name;
          } else if (domain.labelName) {
            const domainName = domain.labelName + '.eth';
            console.log('✅ Found label name from subgraph, constructing:', domainName);
            return domainName;
          }
        }
      }
    } catch (subgraphError) {
      console.log('ENS subgraph query failed:', subgraphError);
    }

    // If subgraph fails, return a placeholder
    console.log('❌ Could not decode domain name for token ID:', tokenId);
    return `ENS Token #${tokenId}`;
  } catch (error) {
    console.error('Error in decodeENSName:', error);
    return `ENS Token #${tokenId}`;
  }
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

  // Add state for current contenthash
  const [currentContentHash, setCurrentContentHash] = useState<string>('');

  // Add state for content association status
  const [contentAlreadyAssociated, setContentAlreadyAssociated] = useState<boolean>(false);

  // Add state for owned domains
  const [ownedDomains, setOwnedDomains] = useState<string[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(true); // Start as true since we fetch domains on mount
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false); // Track if we've completed initial fetch

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
  ]);

  // Add useEffect to fetch owned domains when wallet is connected
  useEffect(() => {
    const fetchOwnedDomains = async () => {
      if (!address) {
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

        let allDomains: string[] = [];

        if (domainsResponse.ok) {
          const domainsData = await domainsResponse.json();
          console.log('Domains response:', domainsData);

          if (domainsData.data?.domains) {
            // Extract domains and filter out invalid ones
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

            console.log('Owned domains found:', ownedDomains);
            allDomains.push(...ownedDomains);

            // Step 2: For each owned domain, get its subdomains (using official ENS pattern)
            for (const domain of ownedDomains) {
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
          }
        } else {
          console.log('ENS subgraph query failed, falling back to NFT-based approach');
        }

        // Fallback: Also fetch NFT-based domains (for additional coverage)
        if (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY) {
          const alchemy = new Alchemy({
            apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
            network: Network.ETH_MAINNET,
          });

          const ensContract = '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85';
          const nameWrapperContract = '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401';

          // Get both regular ENS domains and wrapped domains
          const [ensNfts, wrappedNfts] = await Promise.all([
            alchemy.nft.getNftsForOwner(address, {
              contractAddresses: [ensContract],
            }),
            alchemy.nft.getNftsForOwner(address, {
              contractAddresses: [nameWrapperContract],
            }),
          ]);

          console.log('Raw ENS NFT data:', ensNfts.ownedNfts);
          console.log('Raw Wrapped NFT data:', wrappedNfts.ownedNfts);

          // Extract domain names from the ENS NFT data (fallback)
          const regularDomains = await Promise.allSettled(
            ensNfts.ownedNfts.map(async (nft: any) => {
              console.log('Processing ENS NFT:', nft);

              try {
                const tokenId = nft.tokenId;
                console.log('ENS Token ID:', tokenId);

                // Try to get domain name from Alchemy NFT metadata
                if (nft.name && nft.name !== 'ENS' && !nft.name.startsWith('ENS Token')) {
                  let domainName = nft.name;
                  console.log('Found domain name in Alchemy NFT name:', domainName);

                  // Clean up the name
                  domainName = domainName.replace(/\[.*?\]/g, '').trim();
                  domainName = domainName.replace(/^ENS Token #\d+\s*/, '').trim();

                  // Add .eth if it doesn't have a domain extension
                  if (!domainName.includes('.') && domainName.length > 0) {
                    domainName = domainName + '.eth';
                  }

                  // Validate it's a reasonable domain name
                  if (domainName.length > 4 && !domainName.startsWith('ENS Token')) {
                    console.log('✅ Using domain name from Alchemy:', domainName);
                    return domainName;
                  }
                }

                // Fallback: Try to decode using ENS subgraph
                console.log('Alchemy methods failed, trying ENS subgraph...');
                const domainName = await decodeENSName(tokenId, publicClient);
                console.log('Decoded ENS domain name from subgraph:', domainName);
                return domainName;
              } catch (err) {
                console.error('Error processing ENS NFT:', err);
                return `ENS Token #${nft.tokenId}`;
              }
            })
          );

          // Process wrapped domains (fallback)
          const wrappedDomains = await Promise.allSettled(
            wrappedNfts.ownedNfts.map(async (nft: any) => {
              console.log('Processing Wrapped NFT:', nft);

              try {
                // For wrapped domains, try to get the name from metadata first
                if (nft.name) {
                  console.log('Found wrapped domain name from NFT metadata:', nft.name);
                  return nft.name;
                }

                // Try to decode using the same method as regular domains
                const domainName = await decodeENSName(nft.tokenId, publicClient);
                console.log('Decoded wrapped domain name:', domainName);
                return domainName;
              } catch (err) {
                console.error('Error processing wrapped NFT:', err);
                return `Wrapped Token #${nft.tokenId}`;
              }
            })
          );

          // Extract successful results and filter out failed ones
          const regularDomainResults = regularDomains
            .filter(result => result.status === 'fulfilled')
            .map(result => (result as PromiseFulfilledResult<string>).value);

          const wrappedDomainResults = wrappedDomains
            .filter(result => result.status === 'fulfilled')
            .map(result => (result as PromiseFulfilledResult<string>).value);

          // Add NFT-based domains to the allDomains array
          const nftDomains = [...regularDomainResults, ...wrappedDomainResults];
          console.log('NFT-based domains found:', nftDomains);
          allDomains.push(...nftDomains);
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

        setOwnedDomains(uniqueDomains);
      } catch (err) {
        console.error('Error fetching owned domains:', err);
        setOwnedDomains([]);
      } finally {
        setIsLoadingDomains(false);
        setHasAttemptedFetch(true);
      }
    };

    fetchOwnedDomains();
  }, [address]);

  // Function to save reference with associated domain
  const saveReferenceWithDomain = (reference: string, domain: string) => {
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
  };

  const handleSetContentHash = async () => {
    console.log('🚀 Starting handleSetContentHash for domain:', selectedDomain);
    console.log('📊 Initial state:', {
      selectedDomain,
      walletClient: !!walletClient,
      publicClient: !!publicClient,
      isWrongChain,
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

    // Check if we're on Ethereum mainnet
    if (isWrongChain) {
      console.log('❌ Wrong chain, need Ethereum mainnet');
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

      // Check if domain has a resolver
      if (!ensResolver || ensResolver === '0x0000000000000000000000000000000000000000') {
        console.log('❌ No resolver set for domain');
        setError(
          `Domain "${normalizedDomain}" has no resolver set. Please set a resolver first using the ENS manager at app.ens.domains.`
        );
        setIsLoading(false);
        return;
      }

      console.log('✅ Resolver found:', ensResolver);

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

      // Save the domain association to history
      if (address) {
        saveReferenceWithDomain(swarmReference, normalizedDomain);
      }

      setSuccess(`Successfully set content hash for ${normalizedDomain}!

Your domain now points to: bzz://${shortenHash(swarmReference)}

You can now access your content at:
• ${normalizedDomain} (in ENS-compatible browsers)
• ${normalizedDomain}.limo (via ENS gateway)
• ${normalizedDomain}.link (via ENS gateway)`);
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
          {isWrongChain && (
            <div className={styles.chainWarning}>
              <strong>⚠️ Wrong Network:</strong> Please switch to Ethereum Mainnet to manage ENS
              domains. ENS records are stored on Ethereum mainnet.
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

          <div className={styles.domainSection}>
            <h3>Select Your ENS Domain</h3>

            <div className={styles.domainInput}>
              <label htmlFor="domain">Domain Name:</label>
              <div className={styles.inputContainer}>
                {isLoadingDomains ? (
                  // Show loading state while fetching domains
                  <div className={styles.loadingContainer}>
                    <div className={styles.loadingDomains}>
                      <div className={styles.spinner}></div>
                      🔍 Searching for your ENS domains...
                    </div>
                  </div>
                ) : ownedDomains.length > 0 ? (
                  // Show dropdown if domains were found
                  <select
                    id="domain"
                    value={selectedDomain}
                    onChange={e => handleDomainChange(e.target.value)}
                    className={styles.domainSelect}
                  >
                    <option value="">Select a domain...</option>
                    {ownedDomains.map(domain => (
                      <option key={domain} value={domain}>
                        {domain}
                      </option>
                    ))}
                  </select>
                ) : (
                  // Show input field if no domains were found
                  <input
                    id="domain"
                    type="text"
                    value={selectedDomain}
                    onChange={e => handleDomainChange(e.target.value)}
                    placeholder="myname.eth"
                    className={styles.input}
                  />
                )}
                {!isLoadingDomains && getValidationStatus()}
              </div>
              {!isLoadingDomains && (
                <div className={styles.hint}>
                  {ownedDomains.length > 0
                    ? `Found ${ownedDomains.length} domain(s). Select one from the dropdown above.`
                    : 'Enter your ENS domain name (e.g., myname.eth, myname.xyz)'}
                </div>
              )}
              {!isLoadingDomains && hasAttemptedFetch && ownedDomains.length === 0 && (
                <div className={styles.noDomains}>
                  No ENS domains found for your wallet. You can still enter a domain manually above.
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
                {shortenHash(txHash, 6, 6)}
              </a>
            </div>
          )}

          <div className={styles.actions}>
            <button
              className={styles.setButton}
              onClick={handleSetContentHash}
              disabled={
                !selectedDomain ||
                isLoading ||
                ensAddressLoading ||
                isWrongChain ||
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
              ) : contentAlreadyAssociated ? (
                'Content Already Associated'
              ) : (
                'Set Content Hash'
              )}
            </button>
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
