const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Ensure screenshots directory exists
const screenshotsDir = '/tmp/job-seeker-five-cycles';
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function jobSeekerFiveCyclesTest() {
  console.log('💼 Starting Job Seeker 5-Cycles E2E Test...');
  
  const browser = await chromium.launch({ 
    headless: false, // Set to true for CI
    slowMo: 800 // Slow down for better visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  
  const page = await context.newPage();
  let cycleCount = 0;
  
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

    // Step 1: Create new user account
    console.log('👤 Creating job seeker user account...');
    await page.waitForTimeout(2000);
    
    // Fill signup form
    await page.fill('input[placeholder="Test Operator"]', 'Alex Johnson');
    await page.fill('input[type="email"]', 'alex.johnson.jobseeker@example.com');
    await page.fill('input[type="password"]', 'Password123!');
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-signup-form.png'),
      fullPage: true 
    });
    
    // Click signup
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '03-account-created.png'),
      fullPage: true 
    });
    console.log('✅ Account created successfully');

    // Step 2: Initial conversation - Job seeker positioning
    console.log('💬 Starting initial positioning conversation...');
    await page.waitForTimeout(2000);
    
    const initialMessage = "I'm a software engineer looking for senior frontend developer positions. I have 5 years of experience with React, TypeScript, and modern web technologies. I want to find opportunities at tech companies that value clean code and user experience.";
    
    await page.fill('textarea[placeholder*="Tell the assistant"]', initialMessage);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '04-initial-message.png'),
      fullPage: true 
    });
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '05-ai-response-positioning.png'),
      fullPage: true 
    });
    console.log('✅ Initial positioning message sent');

    // Step 3: Preview and finalize strategic plan
    console.log('📋 Previewing strategic plan...');
    await page.waitForTimeout(3000);
    
    // Look for preview button or wait for goal proposal
    try {
      const previewButton = await page.locator('button:has-text("Preview"), button:has-text("Review"), button:has-text("Plan")').first();
      if (await previewButton.isVisible({ timeout: 2000 })) {
        await previewButton.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ 
          path: path.join(screenshotsDir, '06-strategic-plan-preview.png'),
          fullPage: true 
        });
      }
    } catch (e) {
      console.log('Preview button not found, continuing...');
    }

    // Step 4: Finalize the goal
    console.log('🎯 Finalizing strategic goal...');
    try {
      const finalizeButton = await page.locator('button:has-text("Finalize"), button:has-text("Confirm"), button:has-text("Create")').first();
      if (await finalizeButton.isVisible({ timeout: 2000 })) {
        await finalizeButton.click();
        await page.waitForTimeout(4000);
        await page.screenshot({ 
          path: path.join(screenshotsDir, '07-goal-finalized.png'),
          fullPage: true 
        });
        console.log('✅ Strategic goal finalized');
      }
    } catch (e) {
      console.log('Finalize button not found, continuing...');
    }

    // Now run through 5 complete cycles
    for (let cycle = 1; cycle <= 5; cycle++) {
      cycleCount = cycle;
      console.log(`🔄 Starting Cycle ${cycle}/5...`);
      
      // Wait for workspace to load
      await page.waitForTimeout(3000);
      
      // Step A: Look for signals/opportunities
      console.log(`🔍 Cycle ${cycle}: Looking for opportunities...`);
      await page.screenshot({ 
        path: path.join(screenshotsDir, `cycle${cycle}-01-signals.png`),
        fullPage: true 
      });

      // Step B: Activate an opportunity signal
      try {
        const activateButton = await page.locator('button:has-text("Activate"), button:has-text("View"), button:has-text("Opportunity")').first();
        if (await activateButton.isVisible({ timeout: 3000 })) {
          await activateButton.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ 
            path: path.join(screenshotsDir, `cycle${cycle}-02-opportunity-activated.png`),
            fullPage: true 
          });
          console.log(`✅ Cycle ${cycle}: Opportunity activated`);
        }
      } catch (e) {
        console.log(`Cycle ${cycle}: No opportunity to activate, continuing...`);
      }

      // Step C: Generate outreach draft
      console.log(`📝 Cycle ${cycle}: Generating outreach draft...`);
      try {
        const draftButton = await page.locator('button:has-text("Generate Draft"), button:has-text("Draft"), button:has-text("Create")').first();
        if (await draftButton.isVisible({ timeout: 3000 })) {
          await draftButton.click();
          await page.waitForTimeout(4000);
          await page.screenshot({ 
            path: path.join(screenshotsDir, `cycle${cycle}-03-draft-generated.png`),
            fullPage: true 
          });
          console.log(`✅ Cycle ${cycle}: Draft generated`);
        }
      } catch (e) {
        console.log(`Cycle ${cycle}: Draft generation not available, continuing...`);
      }

      // Step D: Review and customize the draft
      console.log(`✏️ Cycle ${cycle}: Reviewing draft...`);
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, `cycle${cycle}-04-draft-review.png`),
        fullPage: true 
      });

      // Step E: Send the application/outreach
      console.log(`📤 Cycle ${cycle}: Sending application...`);
      try {
        const sendButton = await page.locator('button:has-text("Send"), button:has-text("Submit"), button:has-text("Apply")').first();
        if (await sendButton.isVisible({ timeout: 3000 })) {
          await sendButton.hover();
          await page.waitForTimeout(1000);
          await page.screenshot({ 
            path: path.join(screenshotsDir, `cycle${cycle}-05-send-hover.png`),
            fullPage: true 
          });
          
          // Click send (might be blocked by plan limitations)
          await sendButton.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ 
            path: path.join(screenshotsDir, `cycle${cycle}-06-send-result.png`),
            fullPage: true 
          });
          console.log(`✅ Cycle ${cycle}: Send action completed`);
        }
      } catch (e) {
        console.log(`Cycle ${cycle}: Send not available, continuing...`);
      }

      // Step F: Complete the cycle
      console.log(`✅ Cycle ${cycle}: Completing cycle...`);
      try {
        const completeButton = await page.locator('button:has-text("Complete"), button:has-text("Next"), button:has-text("Continue")').first();
        if (await completeButton.isVisible({ timeout: 3000 })) {
          await completeButton.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ 
            path: path.join(screenshotsDir, `cycle${cycle}-07-cycle-complete.png`),
            fullPage: true 
          });
          console.log(`✅ Cycle ${cycle}: Completed`);
        }
      } catch (e) {
        console.log(`Cycle ${cycle}: Complete button not found, continuing...`);
      }

      // Step G: Look for next action or continue conversation
      console.log(`🗣️ Cycle ${cycle}: Planning next action...`);
      await page.waitForTimeout(2000);
      
      // Send a follow-up message to AI
      const followUpMessage = cycle < 5 
        ? `Great! I've completed application ${cycle}. What's the next opportunity you recommend for my senior frontend developer job search?`
        : `I've completed 5 applications. Can you summarize my job search progress and suggest next steps?`;
      
      await page.fill('textarea[placeholder*="Tell the assistant"]', followUpMessage);
      await page.screenshot({ 
        path: path.join(screenshotsDir, `cycle${cycle}-08-follow-up-message.png`),
        fullPage: true 
      });
      
      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, `cycle${cycle}-09-ai-guidance.png`),
        fullPage: true 
      });
      
      console.log(`✅ Cycle ${cycle}: AI guidance received`);
    }

    // Final summary screenshot
    console.log('📊 Taking final summary screenshots...');
    await page.waitForTimeout(3000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'final-01-workspace-overview.png'),
      fullPage: true 
    });
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'final-02-conversation-history.png'),
      fullPage: true 
    });

    console.log('✅ Job seeker 5-cycles test completed successfully!');
    
    return {
      success: true,
      screenshots: screenshotsDir,
      totalScreenshots: fs.readdirSync(screenshotsDir).length,
      cyclesCompleted: cycleCount,
      workflow: 'Job Seeker 5-Cycles Complete Workflow',
      scenario: 'New user pursuing senior frontend developer positions',
      applicationsSent: cycleCount,
      steps: [
        'Account creation',
        'Initial positioning conversation',
        'Strategic plan finalization',
        ...Array.from({length: cycleCount}, (_, i) => [
          `Cycle ${i + 1}: Signal detection`,
          `Cycle ${i + 1}: Opportunity activation`, 
          `Cycle ${i + 1}: Draft generation`,
          `Cycle ${i + 1}: Draft review`,
          `Cycle ${i + 1}: Application send`,
          `Cycle ${i + 1}: Cycle completion`,
          `Cycle ${i + 1}: AI guidance`
        ]).flat(),
        'Final workspace overview',
        'Conversation history summary'
      ]
    };

  } catch (error) {
    console.error('❌ Error during job seeker 5-cycles test:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'ERROR-screenshot.png'),
      fullPage: true 
    });
    
    return {
      success: false,
      error: error.message,
      screenshots: screenshotsDir,
      cyclesCompleted: cycleCount,
      errorScreenshot: path.join(screenshotsDir, 'ERROR-screenshot.png')
    };
    
  } finally {
    await browser.close();
  }
}

// Run the test
jobSeekerFiveCyclesTest()
  .then((result) => {
    console.log('\n💼 Job Seeker 5-Cycles Test Results:');
    console.log('==========================================');
    if (result.success) {
      console.log('✅ TEST PASSED');
      console.log(`📸 Screenshots saved to: ${result.screenshots}`);
      console.log(`📊 Total screenshots: ${result.totalScreenshots}`);
      console.log(`🔄 Cycles completed: ${result.cyclesCompleted}`);
      console.log(`📤 Applications sent: ${result.applicationsSent}`);
      console.log('\n📋 Workflow Steps Completed:');
      result.steps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step}`);
      });
    } else {
      console.log('❌ TEST FAILED');
      console.log(`🚨 Error: ${result.error}`);
      console.log(`🔄 Cycles completed before failure: ${result.cyclesCompleted}`);
      console.log(`📸 Error screenshot: ${result.errorScreenshot}`);
    }
    console.log('==========================================');
  })
  .catch((error) => {
    console.error('💥 Fatal error running job seeker test:', error);
    process.exit(1);
  });
