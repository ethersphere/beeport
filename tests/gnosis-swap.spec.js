const { test, expect } = require('@playwright/test');

test.describe('Gnosis Chain Real Wallet Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for the app to load
    await page.waitForLoadState('networkidle');

    console.log('🚀 Starting test - make sure you have:');
    console.log('1. MetaMask installed and unlocked');
    console.log('2. Gnosis chain added to MetaMask');
    console.log('3. Some USDC on Gnosis chain for testing');
    console.log('4. The app running on localhost:3000');
  });

  test('Complete swap flow: Gnosis + USDC + 2 days + lowest depth', async ({ page }) => {
    console.log('🔗 Step 1: Connect Wallet');

    // Look for connect wallet button (adjust selector based on your actual button)
    const connectButton = page
      .locator('button')
      .filter({ hasText: /connect/i })
      .first();
    await expect(connectButton).toBeVisible({ timeout: 10000 });
    await connectButton.click();

    // Wait for MetaMask popup and handle connection
    console.log('👛 Please connect your wallet in MetaMask popup...');

    // Wait for wallet connection to complete (look for address or connected state)
    await page.waitForFunction(
      () => {
        // This will wait until the page shows signs of wallet connection
        return (
          document.querySelector('[data-testid="wallet-address"]') ||
          document.querySelector('.wallet-connected') ||
          document.body.innerText.includes('0x')
        );
      },
      { timeout: 60000 }
    );

    console.log('✅ Wallet connected successfully');

    console.log('🌐 Step 2: Select Gnosis Chain');

    // Select Gnosis chain - adjust selector based on your dropdown
    const chainDropdown = page
      .locator('select, [role="combobox"]')
      .filter({ hasText: /chain|network/i })
      .first();
    if (await chainDropdown.isVisible()) {
      await chainDropdown.click();
      // Look for Gnosis option
      await page
        .locator('option, [role="option"]')
        .filter({ hasText: /gnosis|xdai/i })
        .first()
        .click();
    } else {
      // If it's a custom dropdown, look for chain selector
      const chainSelector = page
        .locator('[data-testid*="chain"], .chain-selector, button')
        .filter({ hasText: /chain|network/i })
        .first();
      await chainSelector.click();
      await page.locator('text=/gnosis|xdai/i').first().click();
    }

    // Wait for chain switch in MetaMask if needed
    console.log('🔄 Please approve chain switch in MetaMask if prompted...');
    await page.waitForTimeout(3000);

    console.log('🪙 Step 3: Select USDC Token');

    // Wait for tokens to load after chain selection
    await page.waitForTimeout(2000);

    // Select USDC token
    const tokenDropdown = page
      .locator('select, [role="combobox"]')
      .filter({ hasText: /token|from/i })
      .first();
    if (await tokenDropdown.isVisible()) {
      await tokenDropdown.click();
      await page.locator('option, [role="option"]').filter({ hasText: /usdc/i }).first().click();
    } else {
      // Custom token dropdown
      const tokenSelector = page
        .locator('[data-testid*="token"], .token-selector, button')
        .filter({ hasText: /token|select/i })
        .first();
      await tokenSelector.click();
      await page.locator('text=/usdc/i').first().click();
    }

    console.log('📦 Step 4: Select Lowest Storage Depth');

    // Select the lowest depth (usually 16 or the first option)
    const depthDropdown = page
      .locator('select')
      .filter({ hasText: /storage|stamps|depth/i })
      .first();
    if (await depthDropdown.isVisible()) {
      await depthDropdown.selectOption({ index: 0 }); // First option (lowest depth)
    } else {
      // Look for storage options
      const storageSelector = page
        .locator('[data-testid*="storage"], [data-testid*="depth"]')
        .first();
      if (await storageSelector.isVisible()) {
        await storageSelector.click();
        await page.locator('option').first().click();
      }
    }

    console.log('⏰ Step 5: Select 2 Days Duration');

    // Select 2 days duration
    const durationDropdown = page
      .locator('select')
      .filter({ hasText: /duration|time|days/i })
      .first();
    if (await durationDropdown.isVisible()) {
      // Try to find 2 days option
      const twoDaysOption = page
        .locator('option')
        .filter({ hasText: /2.*day/i })
        .first();
      if (await twoDaysOption.isVisible()) {
        await durationDropdown.selectOption(await twoDaysOption.getAttribute('value'));
      } else {
        // Fallback to second option if "2 days" not found
        await durationDropdown.selectOption({ index: 1 });
      }
    }

    console.log('💰 Step 6: Wait for Price Calculation');

    // Wait for price calculation to complete
    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return text.includes('$') && text.includes('Cost') && !text.includes('Calculating');
      },
      { timeout: 30000 }
    );

    // Verify price is shown
    const priceElement = page.locator('text=/Cost.*\\$/').first();
    await expect(priceElement).toBeVisible();

    const priceText = await priceElement.textContent();
    console.log(`💵 Calculated cost: ${priceText}`);

    console.log('🚀 Step 7: Execute Swap');

    // Find and click execute button
    const executeButton = page
      .locator('button')
      .filter({
        hasText: /execute|swap|buy|purchase/i,
      })
      .and(page.locator(':not([disabled])'))
      .first();

    await expect(executeButton).toBeVisible();
    await expect(executeButton).toBeEnabled();

    await executeButton.click();

    console.log('📝 Step 8: Approve Transactions in MetaMask');
    console.log('Please approve the following transactions in MetaMask:');
    console.log('1. Token approval (if needed)');
    console.log('2. Swap/purchase transaction');

    // Wait for transaction processing
    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return (
          text.includes('Success') ||
          text.includes('Complete') ||
          text.includes('Storage Bought') ||
          text.includes('Batch') ||
          text.includes('ready')
        );
      },
      { timeout: 300000 }
    ); // 5 minutes for real transactions

    console.log('✅ Step 9: Verify Success');

    // Look for success indicators
    const successIndicators = [
      page.locator('text=/success/i'),
      page.locator('text=/complete/i'),
      page.locator('text=/storage bought/i'),
      page.locator('text=/batch.*created/i'),
      page.locator('[data-testid*="success"]'),
      page.locator('.success'),
    ];

    let successFound = false;
    for (const indicator of successIndicators) {
      if (await indicator.isVisible()) {
        successFound = true;
        const successText = await indicator.textContent();
        console.log(`🎉 Success message: ${successText}`);
        break;
      }
    }

    expect(successFound).toBe(true);

    // Look for batch ID or reference
    const batchIdElement = page.locator('text=/0x[a-fA-F0-9]{64}|[a-fA-F0-9]{64}/').first();
    if (await batchIdElement.isVisible()) {
      const batchId = await batchIdElement.textContent();
      console.log(`📦 Batch ID: ${batchId}`);
      expect(batchId).toMatch(/[a-fA-F0-9]{64}/);
    }

    console.log('🎊 Test completed successfully!');

    // Take a screenshot of the final state
    await page.screenshot({ path: 'tests/results/gnosis-swap-success.png', fullPage: true });
  });

  test('Verify upload functionality after swap', async ({ page }) => {
    console.log('📁 Testing file upload functionality');

    // This test assumes you have a successful batch from the previous test
    // or you can manually set up a batch ID

    await page.goto('/');

    // Look for upload section or ready state
    const uploadSection = page.locator('text=/upload|ready/i').first();
    if (await uploadSection.isVisible()) {
      console.log('✅ Upload section is available');

      // Create a test file
      const testFileContent = 'Hello Swarm! This is a test file from Playwright.';

      // Look for file input
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.isVisible()) {
        // Create a temporary test file
        await page.evaluate(content => {
          const blob = new Blob([content], { type: 'text/plain' });
          const file = new File([blob], 'test-file.txt', { type: 'text/plain' });

          const input = document.querySelector('input[type="file"]');
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;

          // Trigger change event
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }, testFileContent);

        // Click upload button
        const uploadButton = page
          .locator('button')
          .filter({ hasText: /upload/i })
          .first();
        await uploadButton.click();

        console.log('📤 File upload initiated...');

        // Wait for upload completion
        await page.waitForFunction(
          () => {
            return (
              document.body.innerText.includes('Upload Successful') ||
              document.body.innerText.includes('Reference:')
            );
          },
          { timeout: 180000 }
        ); // 3 minutes for upload

        console.log('✅ File uploaded successfully!');
      }
    } else {
      console.log('ℹ️ Upload section not available - may need to complete swap first');
    }
  });
});
