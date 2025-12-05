#!/bin/bash

# Simple Base → Gnosis BZZ swap tester
# Usage: ./scripts/testBaseToBzz.sh [BZZ_AMOUNT]
# Example: ./scripts/testBaseToBzz.sh 10

BZZ_AMOUNT="${1:-10}"
WALLET="0xb1c7f17ed88189abf269bf68a3b2ed83c5276aae"

# BZZ has 16 decimals!
AMOUNT_WEI=$(echo "$BZZ_AMOUNT * 10000000000000000" | bc)

echo "🔄 Testing Base → Gnosis: ${BZZ_AMOUNT} BZZ (${AMOUNT_WEI} wei)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

curl --request POST \
  --url https://api.relay.link/quote \
  --header 'Content-Type: application/json' \
  --data "{
  \"user\": \"$WALLET\",
  \"recipient\": \"$WALLET\",
  \"originChainId\": 8453,
  \"destinationChainId\": 100,
  \"originCurrency\": \"0x0000000000000000000000000000000000000000\",
  \"destinationCurrency\": \"0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da\",
  \"amount\": \"$AMOUNT_WEI\",
  \"tradeType\": \"EXACT_OUTPUT\",
  \"slippageTolerance\": \"500\",
  \"refundOnOrigin\": true
}" | jq '{
  success: (if .steps then true else false end),
  bzzAmount: "'$BZZ_AMOUNT' BZZ",
  costUSD: .details.currencyIn.amountUsd,
  gasUSD: .fees.gas.amountUsd,
  relayerUSD: .fees.relayer.amountUsd,
  timeEstimate: (.details.timeEstimate | tostring + "s"),
  error: .message
}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Test different amounts: ./scripts/testBaseToBzz.sh 50"
echo ""
