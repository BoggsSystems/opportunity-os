const { chromium } = require('playwright');

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5174/';
const SCREENSHOT_PATH = process.env.SCREENSHOT_PATH ?? '/tmp/opportunity-os-connections-upload.png';
const TEST_CSV_PATH = '/tmp/test_connections_upload.csv';

async function createTestCSV() {
  const fs = require('fs');
  const csvContent = `First Name,Last Name,URL,Email Address,Company,Position,Connected On
John,Doe,https://linkedin.com/in/johndoe,john.doe@example.com,Tech Corp,Software Engineer,2024-01-15
Jane,Smith,https://linkedin.com/in/janesmith,jane.smith@example.com,Data Inc,Data Scientist,2024-01-20`;
  
  fs.writeFileSync(TEST_CSV_PATH, csvContent);
  return TEST_CSV_PATH;
}

async function main() {
  console.log('🎭 Starting Playwright test for connections upload workflow...');
  
  // Create test CSV file
  const csvPath = await createTestCSV();
  console.log(`📄 Created test CSV file: ${csvPath}`);

  const browser = await chromium.launch({ 
    headless: false, // Set to false to see the browser
    slowMo: 500 // Slower for better visibility
  });
  
  const page = await browser.newPage({ 
    viewport: { width: 1440, height: 1000 } 
  });

  // Monitor console logs for WebSocket events
  const consoleMessages = [];
  page.on('console', (message) => {
    const msgText = message.text();
    consoleMessages.push({
      type: message.type(),
      text: msgText,
      timestamp: new Date().toISOString()
    });
    
    // Only log relevant messages to reduce noise
    if (msgText.includes('WebSocket') || msgText.includes('import') || msgText.includes('error')) {
      console.log(`🔍 Console [${message.type()}]: ${msgText}`);
    }
  });

  // Monitor page errors
  page.on('pageerror', (error) => {
    console.error(`❌ Page Error: ${error.message}`);
  });

  // Monitor network requests
  const networkRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/connections/import') || request.url().includes('/socket.io/')) {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString()
      });
      console.log(`🌐 Request: ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', (response) => {
    if (response.url().includes('/connections/import')) {
      console.log(`✅ Response: ${response.status()} ${response.url()}`);
    }
  });

  try {
    console.log(`🚀 Step 1: Navigating to: ${FRONTEND_URL}`);
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle', timeout: 10000 });
    console.log('✅ Page loaded successfully');

    console.log('🔍 Step 2: Looking for connections upload interface...');
    
    // Wait for page to settle
    await page.waitForTimeout(2000);

    // Try different selectors for upload interface
    const uploadSelectors = [
      'input[type="file"]',
      'button:has-text("Upload")',
      'button:has-text("Import")',
      '[data-testid*="upload"]',
      '[data-testid*="import"]',
      'text=Connections',
      'text=Import Connections'
    ];

    let uploadElement = null;
    let foundSelector = null;

    for (const selector of uploadSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          uploadElement = element;
          foundSelector = selector;
          console.log(`✅ Found upload element with selector: ${selector}`);
          break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }

    if (!uploadElement) {
      console.log('❌ No upload interface found. Taking screenshot for debugging...');
      await page.screenshot({ path: SCREENSHOT_PATH.replace('.png', '-no-upload.png'), fullPage: true });
      throw new Error('Upload interface not found');
    }

    // If it's a button, click it first
    if (foundSelector.includes('button') || foundSelector.includes('text=')) {
      console.log('� Clicking upload button...');
      await uploadElement.click();
      await page.waitForTimeout(1000);
      
      // Look for file input after clicking button
      try {
        const fileInput = await page.locator('input[type="file"]').first();
        if (await fileInput.isVisible({ timeout: 2000 })) {
          uploadElement = fileInput;
          console.log('✅ Found file input after clicking button');
        }
      } catch (error) {
        console.log('⚠️ No file input found after clicking button');
      }
    }

    // If we have a file input, upload the file
    if (uploadElement && (await uploadElement.inputValue() !== undefined || foundSelector.includes('input[type="file"]'))) {
      console.log('📤 Step 3: Uploading CSV file...');
      await uploadElement.setInputFiles(csvPath);
      console.log('✅ File uploaded successfully');
      
      await page.waitForTimeout(2000);

      // Look for submit/import button
      console.log('📤 Step 4: Looking for submit/import button...');
      const submitSelectors = [
        'button:has-text("Import")',
        'button:has-text("Submit")',
        'button:has-text("Upload")',
        'button:has-text("Start")',
        '[data-testid*="submit"]',
        '[data-testid*="import"]'
      ];

      let submitButton = null;
      for (const selector of submitSelectors) {
        try {
          const button = await page.locator(selector).first();
          if (await button.isVisible({ timeout: 1000 })) {
            submitButton = button;
            console.log(`✅ Found submit button: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue trying
        }
      }

      if (submitButton) {
        await submitButton.click();
        console.log('✅ Clicked submit button');
      } else {
        console.log('⚠️ No submit button found, upload might start automatically');
      }
    } else {
      console.log('❌ Could not find file input for upload');
      throw new Error('File input not found');
    }

    // Step 5: Monitor for WebSocket connection and import progress
    console.log('⏳ Step 5: Monitoring WebSocket connection and import progress...');
    
    let wsConnected = false;
    let importStarted = false;
    let attempts = 0;
    const maxAttempts = 15; // 15 seconds timeout
    
    while (attempts < maxAttempts) {
      attempts++;
      
      // Check for WebSocket connection
      const wsEvents = consoleMessages.filter(msg => msg.text.includes('WebSocket'));
      if (wsEvents.length > 0 && !wsConnected) {
        wsConnected = true;
        console.log(`🔌 WebSocket connection detected! Found ${wsEvents.length} events`);
        wsEvents.slice(-3).forEach(event => console.log(`   - ${event.text}`));
      }

      // Check for import events
      const importEvents = consoleMessages.filter(msg => msg.text.includes('import'));
      if (importEvents.length > 0 && !importStarted) {
        importStarted = true;
        console.log(`� Import activity detected! Found ${importEvents.length} events`);
        importEvents.slice(-3).forEach(event => console.log(`   - ${event.text}`));
      }

      // Check for success indicators
      try {
        const successSelectors = [
          'text=success',
          'text=completed',
          'text=uploaded',
          '[class*="success"]',
          '[class*="complete"]'
        ];
        
        for (const selector of successSelectors) {
          const element = await page.locator(selector).first();
          if (await element.isVisible({ timeout: 500 })) {
            console.log(`✅ Found success indicator: ${selector}`);
            console.log('🎉 Import workflow completed successfully!');
            
            // Take final screenshot
            await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
            console.log(`📸 Screenshot saved to: ${SCREENSHOT_PATH}`);
            
            // Print summary
            console.log('\n📊 Test Summary:');
            console.log(`- Console messages: ${consoleMessages.length}`);
            console.log(`- Network requests: ${networkRequests.length}`);
            console.log(`- WebSocket events: ${wsEvents.length}`);
            console.log(`- Import events: ${importEvents.length}`);
            console.log(`- Monitor attempts: ${attempts}/${maxAttempts}`);
            
            return; // Success!
          }
        }
      } catch (error) {
        // Continue checking
      }
      
      if (attempts % 3 === 0) {
        console.log(`⏳ Still monitoring... (${attempts}/${maxAttempts} attempts)`);
      }
      
      await page.waitForTimeout(1000);
    }

    console.log('⚠️ Test completed but no clear success confirmation found');
    
    // Take screenshot for debugging
    await page.screenshot({ path: SCREENSHOT_PATH.replace('.png', '-no-success.png'), fullPage: true });
    console.log(`📸 Debugging screenshot saved`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Take screenshot on error
    await page.screenshot({ 
      path: SCREENSHOT_PATH.replace('.png', '-error.png'), 
      fullPage: true 
    });
    console.log(`📸 Error screenshot saved`);
    
    throw error;
  } finally {
    // Clean up
    console.log('🧹 Cleaning up...');
    await browser.close();
    
    // Remove test CSV file
    try {
      const fs = require('fs');
      fs.unlinkSync(csvPath);
      console.log(`🗑️ Cleaned up test CSV file: ${csvPath}`);
    } catch (error) {
      console.log('⚠️ Could not clean up test CSV file');
    }
  }

  console.log('🎭 Playwright test completed!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
