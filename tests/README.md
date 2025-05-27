# Playwright Real Wallet Testing

This directory contains Playwright tests for real wallet integration testing.

## Prerequisites

1. **MetaMask Extension**: Install MetaMask browser extension
2. **Test Wallet**: Set up a dedicated test wallet with small amounts
3. **Gnosis Chain**: Add Gnosis chain to MetaMask
4. **Test Funds**: Have some USDC on Gnosis chain for testing
5. **App Running**: Make sure your app is running on `http://localhost:3000`

## Setup

1. Install dependencies:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

2. Start your development server:

```bash
npm run dev
```

3. Make sure MetaMask is installed and configured with:
   - Gnosis chain added
   - Test wallet imported
   - Some USDC balance on Gnosis

## Running Tests

### Run all tests:

```bash
npx playwright test
```

### Run specific test:

```bash
npx playwright test tests/gnosis-swap.spec.js
```

### Run with UI (recommended for first time):

```bash
npx playwright test --ui
```

### Run in headed mode (see browser):

```bash
npx playwright test --headed
```

## Test Flow

The main test performs these steps:

1. **Connect Wallet** - Connects to MetaMask
2. **Select Gnosis Chain** - Switches to Gnosis network
3. **Select USDC Token** - Chooses USDC as payment token
4. **Select Lowest Depth** - Picks the smallest storage option
5. **Select 2 Days** - Sets duration to 2 days
6. **Calculate Price** - Waits for price estimation
7. **Execute Swap** - Performs the actual transaction
8. **Verify Success** - Confirms transaction completion

## Manual Steps Required

During the test, you'll need to manually:

1. **Approve wallet connection** in MetaMask popup
2. **Switch to Gnosis chain** if prompted
3. **Approve token spending** transaction
4. **Confirm swap transaction** in MetaMask

## Test Configuration

Key test parameters:

- **Chain**: Gnosis (Chain ID: 100)
- **Token**: USDC
- **Duration**: 2 days
- **Storage**: Lowest depth (16)
- **Timeout**: 5 minutes for real transactions

## Troubleshooting

### Common Issues:

1. **MetaMask not detected**: Make sure MetaMask is installed and unlocked
2. **Chain not available**: Add Gnosis chain to MetaMask manually
3. **Insufficient funds**: Ensure test wallet has USDC on Gnosis
4. **Timeout errors**: Real transactions can take time, be patient
5. **Selector not found**: UI might have changed, update selectors

### Debug Mode:

Run with debug to see detailed logs:

```bash
DEBUG=pw:api npx playwright test --headed
```

### Screenshots:

Failed tests automatically capture screenshots in `test-results/`
Successful tests save screenshots in `tests/results/`

## Test Results

After successful test:

- Screenshots saved to `tests/results/`
- HTML report available: `npx playwright show-report`
- Console logs show step-by-step progress

## Safety Notes

⚠️ **Important**:

- Use a dedicated test wallet with small amounts
- Never use your main wallet for testing
- Test on testnets when possible
- Monitor gas costs and transaction fees
- Keep test amounts minimal (< $10 worth)

## Extending Tests

To add more test scenarios:

1. Create new test files in `tests/` directory
2. Follow the same pattern as `gnosis-swap.spec.js`
3. Add different chains, tokens, or flows
4. Update selectors based on your UI components
