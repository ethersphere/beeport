// This file now contains minimal utilities for LiFi SDK integration
// Most quote functionality has been moved to RelayQuotes.ts

import { ChainId } from '@lifi/sdk';

// Keep LiFi SDK exports for chain and token utilities that are still used
export { ChainId } from '@lifi/sdk';

// Note: All quote functions (getGnosisQuote, getCrossChainQuote) have been replaced
// by the Relay API implementation in RelayQuotes.ts
//
// Current architecture:
// All stamp purchases (same-chain and cross-chain) → Relay API via RelayQuotes.ts
