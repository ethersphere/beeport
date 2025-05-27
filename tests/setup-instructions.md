# Browser Setup for Real Wallet Testing

## Issue: Can't Install MetaMask in Incognito/Guest Mode

If you're getting "You can't add or remove items when in Incognito or Guest mode", here are your options:

## **Solution 1: Use Regular Browser Mode (Recommended)**

1. **Exit Incognito/Guest mode**
2. **Open regular Chrome/Edge browser**
3. **Install MetaMask extension**:
   - Go to Chrome Web Store
   - Search for "MetaMask"
   - Click "Add to Chrome"
4. **Set up test wallet**
5. **Run tests in regular mode**

Update Playwright config to use regular browser:

```javascript
// playwright.config.js - Update launchOptions
launchOptions: {
  headless: false,
  slowMo: 1000,
  // Remove incognito mode
  args: [
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--no-sandbox',
    '--disable-setuid-sandbox'
    // Don't use --incognito
  ]
}
```

## **Solution 2: Use WalletConnect (No Extension Needed)**

If you prefer not to install MetaMask, use WalletConnect with mobile wallet:

1. **Install mobile wallet** (MetaMask mobile, Trust Wallet, etc.)
2. **Fund with test tokens**
3. **Use WalletConnect in your app**
4. **Scan QR code with mobile wallet**

## **Solution 3: Use Browser with Pre-installed MetaMask**

Some browsers come with built-in wallet support:

- **Brave Browser** (has built-in wallet)
- **Opera Browser** (has built-in wallet)

## **Solution 4: Use Development Profile**

Create a dedicated browser profile for testing:

```bash
# Chrome with custom profile
google-chrome --user-data-dir=/tmp/test-profile --disable-web-security
```

Then install MetaMask in this profile.

## **Solution 5: Mock Wallet for Testing**

If you want to test UI without real transactions:

```javascript
// Add to your test file
test.beforeEach(async ({ page }) => {
  // Mock wallet object
  await page.addInitScript(() => {
    window.ethereum = {
      isMetaMask: true,
      request: async ({ method, params }) => {
        if (method === 'eth_requestAccounts') {
          return ['0x742d35Cc6634C0532925a3b8D4C9db96590c6C87'];
        }
        if (method === 'eth_chainId') {
          return '0x64'; // Gnosis chain
        }
        // Add more mock responses as needed
      },
      on: () => {},
      removeListener: () => {},
    };
  });
});
```

## **Recommended Approach**

For real wallet testing, **Solution 1** (regular browser mode) is best because:

- ✅ Real wallet interactions
- ✅ Real transactions
- ✅ Full MetaMask functionality
- ✅ Most accurate testing

## **Quick Setup Steps**

1. **Close incognito/guest browser**
2. **Open regular Chrome/Edge**
3. **Install MetaMask extension**
4. **Import test wallet with small funds**
5. **Add Gnosis chain to MetaMask**
6. **Run tests**: `npm run test:e2e:headed`

## **Safety Reminder**

⚠️ **Always use a dedicated test wallet with minimal funds for testing!**
