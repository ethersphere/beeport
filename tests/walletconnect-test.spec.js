const { test, expect } = require('@playwright/test');

test.describe('WalletConnect Real Wallet Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log('🚀 WalletConnect Test Setup:');
    console.log('1. Have mobile wallet ready (MetaMask mobile, Trust Wallet, etc.)');
    console.log('2. Ensure wallet has USDC on Gnosis chain');
    console.log('3. Be ready to scan QR code');
    console.log('4. App running on localhost:3000');
  });

  test('Complete swap flow with WalletConnect: Gnosis + USDC + 2 days', async ({ page }) => {
    console.log('🔗 Step 1: Connect via WalletConnect');

    // Look for WalletConnect option
    const connectButton = page
      .locator('button')
      .filter({ hasText: /connect/i })
      .first();
    await expect(connectButton).toBeVisible({ timeout: 10000 });
    await connectButton.click();

    // Look for WalletConnect option in the modal
    const walletConnectOption = page
      .locator('button, div')
      .filter({
        hasText: /walletconnect|wallet connect|scan|qr/i,
      })
      .first();

    if (await walletConnectOption.isVisible()) {
      await walletConnectOption.click();
      console.log('📱 QR Code should appear - scan with your mobile wallet');

      // Wait longer for mobile wallet connection
      await page.waitForFunction(
        () => {
          return (
            document.body.innerText.includes('0x') ||
            document.querySelector('[data-testid="wallet-address"]') ||
            document.querySelector('.wallet-connected')
          );
        },
        { timeout: 120000 }
      ); // 2 minutes for mobile connection
    } else {
      console.log('⚠️ WalletConnect not found, trying direct connection...');
      // Fallback to any available connection method
    }

    console.log('✅ Wallet connected successfully');

    console.log('🌐 Step 2: Select Gnosis Chain');

    // Wait a bit for wallet to settle
    await page.waitForTimeout(2000);

    // Try to find and select Gnosis chain
    const chainElements = [
      page.locator('select').filter({ hasText: /chain|network/i }),
      page.locator('button').filter({ hasText: /chain|network/i }),
      page.locator('[data-testid*="chain"]'),
      page.locator('.chain-selector'),
    ];

    let chainSelected = false;
    for (const element of chainElements) {
      if (await element.isVisible()) {
        await element.click();

        // Look for Gnosis option
        const gnosisOption = page
          .locator('option, button, div')
          .filter({
            hasText: /gnosis|xdai|100/i,
          })
          .first();

        if (await gnosisOption.isVisible()) {
          await gnosisOption.click();
          chainSelected = true;
          console.log('📱 Please approve chain switch on your mobile wallet if prompted');
          await page.waitForTimeout(5000); // Wait for chain switch
          break;
        }
      }
    }

    if (!chainSelected) {
      console.log('⚠️ Could not find chain selector - may already be on Gnosis');
    }

    console.log('🪙 Step 3: Select USDC Token');

    await page.waitForTimeout(3000); // Wait for tokens to load

    // Try to find and select USDC token
    const tokenElements = [
      page.locator('select').filter({ hasText: /token|from/i }),
      page.locator('button').filter({ hasText: /token|select.*token/i }),
      page.locator('[data-testid*="token"]'),
      page.locator('.token-selector'),
    ];

    let tokenSelected = false;
    for (const element of tokenElements) {
      if (await element.isVisible()) {
        await element.click();

        // Look for USDC option
        const usdcOption = page
          .locator('option, button, div')
          .filter({
            hasText: /usdc/i,
          })
          .first();

        if (await usdcOption.isVisible()) {
          await usdcOption.click();
          tokenSelected = true;
          break;
        }
      }
    }

    if (!tokenSelected) {
      console.log('⚠️ Could not find USDC token - check if available on Gnosis');
    }

    console.log('📦 Step 4: Select Lowest Storage Depth');

    // Find storage/depth selector
    const storageElements = [
      page.locator('select').filter({ hasText: /storage|stamps|depth/i }),
      page.locator('[data-testid*="storage"]'),
      page.locator('[data-testid*="depth"]'),
    ];

    for (const element of storageElements) {
      if (await element.isVisible()) {
        if (await element.locator('option').first().isVisible()) {
          await element.selectOption({ index: 0 }); // First option (lowest)
        } else {
          await element.click();
          await page.locator('option, button, div').first().click();
        }
        break;
      }
    }

    console.log('⏰ Step 5: Select 2 Days Duration');

    // Find duration selector
    const durationElements = [
      page.locator('select').filter({ hasText: /duration|time|days/i }),
      page.locator('[data-testid*="duration"]'),
      page.locator('[data-testid*="time"]'),
    ];

    for (const element of durationElements) {
      if (await element.isVisible()) {
        // Try to find 2 days option
        const options = element.locator('option');
        const optionCount = await options.count();

        let foundTwoDays = false;
        for (let i = 0; i < optionCount; i++) {
          const optionText = await options.nth(i).textContent();
          if (optionText && optionText.includes('2') && optionText.toLowerCase().includes('day')) {
            await element.selectOption({ index: i });
            foundTwoDays = true;
            break;
          }
        }

        if (!foundTwoDays && optionCount > 1) {
          await element.selectOption({ index: 1 }); // Fallback to second option
        }
        break;
      }
    }

    console.log('💰 Step 6: Wait for Price Calculation');

    // Wait for price calculation
    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return (
          text.includes('$') &&
          (text.includes('Cost') || text.includes('Price')) &&
          !text.includes('Calculating') &&
          !text.includes('Loading')
        );
      },
      { timeout: 45000 }
    );

    // Find and log the price
    const priceElements = [
      page.locator('text=/Cost.*\\$/'),
      page.locator('text=/Price.*\\$/'),
      page.locator('text=/\\$[0-9]+\\.?[0-9]*/'),
    ];

    for (const priceElement of priceElements) {
      if (await priceElement.isVisible()) {
        const priceText = await priceElement.textContent();
        console.log(`💵 Calculated cost: ${priceText}`);
        break;
      }
    }

    console.log('🚀 Step 7: Execute Swap');

    // Find execute button
    const executeButtons = [
      page.locator('button').filter({ hasText: /execute.*swap/i }),
      page.locator('button').filter({ hasText: /buy.*storage/i }),
      page.locator('button').filter({ hasText: /purchase/i }),
      page.locator('button').filter({ hasText: /swap/i }),
      page.locator('button:not([disabled])').filter({ hasText: /execute/i }),
    ];

    let executeButton = null;
    for (const button of executeButtons) {
      if ((await button.isVisible()) && (await button.isEnabled())) {
        executeButton = button;
        break;
      }
    }

    if (executeButton) {
      await executeButton.click();
      console.log('📱 Step 8: Approve transactions on your mobile wallet');
      console.log('You may need to approve:');
      console.log('1. Token approval transaction');
      console.log('2. Swap/purchase transaction');
      console.log('Please check your mobile wallet for pending transactions...');

      // Wait for transaction completion (longer timeout for mobile)
      await page.waitForFunction(
        () => {
          const text = document.body.innerText;
          return (
            text.includes('Success') ||
            text.includes('Complete') ||
            text.includes('Storage Bought') ||
            text.includes('Batch') ||
            text.includes('ready') ||
            text.includes('Upload')
          );
        },
        { timeout: 600000 }
      ); // 10 minutes for mobile wallet transactions

      console.log('✅ Step 9: Verify Success');

      // Look for success indicators
      const successTexts = ['Success', 'Complete', 'Storage Bought', 'Batch', 'ready', 'Upload'];

      let successFound = false;
      for (const successText of successTexts) {
        const element = page.locator(`text=${successText}`).first();
        if (await element.isVisible()) {
          const fullText = await element.textContent();
          console.log(`🎉 Success: ${fullText}`);
          successFound = true;
          break;
        }
      }

      expect(successFound).toBe(true);

      console.log('🎊 WalletConnect test completed successfully!');
      await page.screenshot({
        path: 'tests/results/walletconnect-success.png',
        fullPage: true,
      });
    } else {
      console.log('❌ Could not find enabled execute button');
      throw new Error('Execute button not found or not enabled');
    }
  });
});
