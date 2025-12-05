# Scripts Directory

Utility scripts for testing, debugging, and data management.

## 🔍 Relay API Testing (Liquidity)

### Find Liquidity Limits (All Routes)

```bash
node scripts/testRelayAPI.js
```

Tests 1, 5, 10, 25, 50, 100, 200 BZZ across multiple chains.
Shows which amounts work and where liquidity breaks.

### Test Single Route (Detailed)

```bash
node scripts/testSingleRoute.js [chainId] [start] [end] [step]

# Examples:
node scripts/testSingleRoute.js 1 10 100 10      # Ethereum: 10-100 BZZ
node scripts/testSingleRoute.js 100 1 50 5       # Gnosis: 1-50 BZZ
node scripts/testSingleRoute.js 137 5 30 5       # Polygon: 5-30 BZZ
```

**Chain IDs:** 1=Ethereum, 100=Gnosis, 137=Polygon, 42161=Arbitrum, 8453=Base

### Test with Your Wallet

```bash
./scripts/testRelayCurl.sh YOUR_WALLET_ADDRESS 10
```

Replace address and amount (in BZZ).

### Debug Failing Swaps

1. Open browser console during swap attempt
2. Find: `🌐 Calling Relay API with request:`
3. Copy the request object
4. Edit `testRelayAPI.js` → update `customRequest`
5. Run: `node scripts/testRelayAPI.js custom`

### Find Liquidity Limits

Test incrementally: 1 → 5 → 10 → 50 → 100 BZZ

Where it fails = your liquidity limit.

### Verify Gas Top-up Format

```bash
node scripts/verifyGasTopupFormat.js
```

---

## 💰 Price Testing

```bash
node scripts/testFromBZZ.js    # BZZ price conversions
node scripts/testFromUSD.js    # USD to token calculations
node scripts/testTo.js         # Token amount calculations
node scripts/testCC.js         # Cross-chain pricing
```

---

## 📥 Registry Data Management

### Export Data

```bash
node scripts/export_registry_data.js
```

### Import Data

```bash
node scripts/import_registry_data.js
```

---

## Common Issues

**"No routes found"**

- All amounts: Token pair not supported
- Large amounts only: Liquidity limit

**Testing Strategy**

1. Start small (1-5 BZZ)
2. Increase gradually
3. Note where it fails
4. That's your liquidity ceiling
