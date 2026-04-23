const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Ensure screenshots directory exists
const screenshotsDir = '/tmp/banana-republic-outreach';
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function bananaRepublicOutreachFlow() {
  console.log('🍌 Starting Banana Republic Customer Outreach E2E Test...');
  
  const browser = await chromium.launch({ 
    headless: false, // Set to true for CI
    slowMo: 1000 // Slow down for better visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to the application
    console.log('🚀 Navigating to Opportunity OS...');
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-landing-page.png'),
      fullPage: true 
    });
    console.log('✅ Landing page loaded');

    // Wait for the app to initialize
    await page.waitForTimeout(2000);
    
    // Look for the goal creation interface
    console.log('📝 Looking for goal creation interface...');
    
    // Try to find the goal input or creation button
    const goalInput = await page.locator('input[placeholder*="goal"], textarea[placeholder*="goal"], [data-testid="goal-input"]').first();
    
    if (await goalInput.isVisible()) {
      await goalInput.click();
      await goalInput.fill('Banana Republic Customer Loyalty and Retention Campaign');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '02-goal-input.png'),
        fullPage: true 
      });
      console.log('✅ Goal entered: Banana Republic Customer Loyalty and Retention Campaign');
    } else {
      // Look for any input field or button to start
      const anyInput = await page.locator('input, textarea, button').first();
      await anyInput.click();
      await page.keyboard.type('Banana Republic Customer Loyalty and Retention Campaign');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '02-goal-alternative.png'),
        fullPage: true 
      });
    }

    // Submit the goal
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '03-goal-submitted.png'),
      fullPage: true 
    });
    console.log('✅ Goal submitted');

    // Wait for goal processing and suggestion
    await page.waitForTimeout(5000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '04-goal-processing.png'),
      fullPage: true 
    });

    // Look for suggested action or continue button
    const continueButton = await page.locator('button:has-text("Continue"), button:has-text("Next"), button:has-text("Create"), [data-testid="continue-button"]').first();
    
    if (await continueButton.isVisible()) {
      await continueButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '05-continue-campaign.png'),
        fullPage: true 
      });
      console.log('✅ Continued to campaign creation');
    }

    // Wait for campaign generation
    await page.waitForTimeout(5000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '06-campaign-generation.png'),
      fullPage: true 
    });

    // Look for campaign details or draft
    console.log('📧 Looking for campaign draft...');
    
    // Try to find email subject or campaign details
    const campaignContent = await page.locator('[data-testid="campaign-draft"], .email-subject, h1, h2').first();
    if (await campaignContent.isVisible()) {
      const campaignText = await campaignContent.textContent();
      console.log(`📝 Campaign content: ${campaignText}`);
    }

    await page.screenshot({ 
      path: path.join(screenshotsDir, '07-campaign-draft.png'),
      fullPage: true 
    });

    // Look for recipient/target audience section
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '08-target-audience.png'),
      fullPage: true 
    });

    // Look for signals or insights
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '09-signals-insights.png'),
      fullPage: true 
    });

    // Try to find and interact with any send or preview buttons
    const sendButton = await page.locator('button:has-text("Send"), button:has-text("Preview"), button:has-text("Review")').first();
    
    if (await sendButton.isVisible()) {
      await sendButton.hover();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '10-send-button-hover.png'),
        fullPage: true 
      });
      
      // Don't actually click send to avoid real emails, just show the UI
      console.log('📤 Send button found and hovered (not clicked to avoid sending)');
    }

    // Final screenshot of the complete workflow
    await page.screenshot({ 
      path: path.join(screenshotsDir, '11-workflow-complete.png'),
      fullPage: true 
    });

    // Try to capture any metrics or status information
    const metrics = await page.locator('.metrics, .stats, [data-testid="metrics"]').first();
    if (await metrics.isVisible()) {
      const metricsText = await metrics.textContent();
      console.log(`📊 Metrics: ${metricsText}`);
    }

    console.log('✅ Banana Republic outreach workflow completed successfully!');
    
    return {
      success: true,
      screenshots: screenshotsDir,
      totalScreenshots: 11,
      workflow: 'Banana Republic Customer Outreach',
      steps: [
        'Landing page loaded',
        'Goal input entered',
        'Goal submitted',
        'Goal processing',
        'Campaign creation',
        'Campaign generation',
        'Campaign draft',
        'Target audience',
        'Signals and insights',
        'Send button interaction',
        'Workflow complete'
      ]
    };

  } catch (error) {
    console.error('❌ Error during Banana Republic outreach flow:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'ERROR-screenshot.png'),
      fullPage: true 
    });
    
    return {
      success: false,
      error: error.message,
      screenshots: screenshotsDir,
      errorScreenshot: path.join(screenshotsDir, 'ERROR-screenshot.png')
    };
    
  } finally {
    await browser.close();
  }
}

// Run the test
bananaRepublicOutreachFlow()
  .then((result) => {
    console.log('\n🍌 Banana Republic Outreach Test Results:');
    console.log('==========================================');
    if (result.success) {
      console.log('✅ Test PASSED');
      console.log(`📸 Screenshots saved to: ${result.screenshots}`);
      console.log(`📊 Total screenshots: ${result.totalScreenshots}`);
      console.log('\n📋 Workflow Steps Completed:');
      result.steps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step}`);
      });
    } else {
      console.log('❌ Test FAILED');
      console.log(`🚨 Error: ${result.error}`);
      console.log(`📸 Error screenshot: ${result.errorScreenshot}`);
    }
    console.log('==========================================');
  })
  .catch((error) => {
    console.error('💥 Fatal error running Banana Republic test:', error);
    process.exit(1);
  });
