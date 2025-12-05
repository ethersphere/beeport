#!/bin/bash

# Test Relay API with curl
# Usage: ./scripts/testRelayCurl.sh [YOUR_WALLET_ADDRESS] [AMOUNT_IN_BZZ]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
WALLET_ADDRESS="${1:-0xb1c7f17ed88189abf269bf68a3b2ed83c5276aae}"
BZZ_AMOUNT="${2:-10}" # Default 10 BZZ

# Constants
GNOSIS_CHAIN_ID=100
BZZ_TOKEN="0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da"

# Convert BZZ amount to wei (BZZ has 16 decimals, not 18!)
# For bash, we'll use bc for calculation
AMOUNT_WEI=$(echo "$BZZ_AMOUNT * 10000000000000000" | bc)

echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║           Relay API Test - Direct curl Request                ║${NC}"
echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
echo ""
echo "Configuration:"
echo "  Wallet: $WALLET_ADDRESS"
echo "  Amount: $BZZ_AMOUNT BZZ ($AMOUNT_WEI wei)"
echo ""

# Test 1: Simple same-chain swap (Gnosis xDAI -> BZZ)
echo -e "${YELLOW}Test 1: Same-chain swap (Gnosis xDAI -> BZZ)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST https://api.relay.link/quote \
  -H "Content-Type: application/json" \
  -d "{
    \"user\": \"$WALLET_ADDRESS\",
    \"recipient\": \"$WALLET_ADDRESS\",
    \"originChainId\": $GNOSIS_CHAIN_ID,
    \"destinationChainId\": $GNOSIS_CHAIN_ID,
    \"originCurrency\": \"0x0000000000000000000000000000000000000000\",
    \"destinationCurrency\": \"$BZZ_TOKEN\",
    \"amount\": \"$AMOUNT_WEI\",
    \"tradeType\": \"EXACT_OUTPUT\",
    \"slippageTolerance\": \"500\",
    \"refundOnOrigin\": true
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Success! (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq '.'
else
    echo -e "${RED}❌ Failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq '.'
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 2: Cross-chain swap (Ethereum ETH -> Gnosis BZZ)
echo -e "${YELLOW}Test 2: Cross-chain swap (Ethereum ETH -> Gnosis BZZ)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST https://api.relay.link/quote \
  -H "Content-Type: application/json" \
  -d "{
    \"user\": \"$WALLET_ADDRESS\",
    \"recipient\": \"$WALLET_ADDRESS\",
    \"originChainId\": 1,
    \"destinationChainId\": $GNOSIS_CHAIN_ID,
    \"originCurrency\": \"0x0000000000000000000000000000000000000000\",
    \"destinationCurrency\": \"$BZZ_TOKEN\",
    \"amount\": \"$AMOUNT_WEI\",
    \"tradeType\": \"EXACT_OUTPUT\",
    \"slippageTolerance\": \"500\",
    \"refundOnOrigin\": true,
    \"topupGas\": true,
    \"topupGasAmount\": \"1.00\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Success! (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq '.'
else
    echo -e "${RED}❌ Failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq '.'
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 3: Cross-chain with USDC (better liquidity)
echo -e "${YELLOW}Test 3: Cross-chain swap (Ethereum USDC -> Gnosis BZZ)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST https://api.relay.link/quote \
  -H "Content-Type: application/json" \
  -d "{
    \"user\": \"$WALLET_ADDRESS\",
    \"recipient\": \"$WALLET_ADDRESS\",
    \"originChainId\": 1,
    \"destinationChainId\": $GNOSIS_CHAIN_ID,
    \"originCurrency\": \"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48\",
    \"destinationCurrency\": \"$BZZ_TOKEN\",
    \"amount\": \"$AMOUNT_WEI\",
    \"tradeType\": \"EXACT_OUTPUT\",
    \"slippageTolerance\": \"500\",
    \"refundOnOrigin\": true,
    \"topupGas\": true,
    \"topupGasAmount\": \"1.00\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Success! (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq '.'
else
    echo -e "${RED}❌ Failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq '.'
fi

echo ""
echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║                         Summary                                ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "If you see 'Invalid address' errors, replace the wallet address:"
echo "  ./scripts/testRelayCurl.sh YOUR_WALLET_ADDRESS $BZZ_AMOUNT"
echo ""
echo "To test different amounts:"
echo "  ./scripts/testRelayCurl.sh $WALLET_ADDRESS 50"
echo ""
echo "Note: You need 'jq' installed for pretty JSON output"
echo "  Install: brew install jq (macOS) or apt-get install jq (Ubuntu)"
echo ""

