const { chromium } = require('playwright');

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173/';
const SCREENSHOT_PATH = process.env.SCREENSHOT_PATH ?? '/tmp/opportunity-os-email-campaign-flow.png';

async function sendConductorMessage(page, text) {
  await page.getByLabel('Message the Conductor').fill(text);
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/ai/converse'),
    { timeout: 70000 },
  );
  await page.locator('.composer .send-button').click();
  const response = await responsePromise;
  await page.locator('.message.pending').waitFor({ state: 'detached', timeout: 20000 }).catch(() => undefined);
  return response;
}

async function clickAndWaitForApi(page, buttonName, path) {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes(path),
    { timeout: 70000 },
  );
  await page.getByRole('button', { name: buttonName }).click();
  return responsePromise;
}

async function readCanvasAction(page) {
  return page.locator('.canvas-action-header h2').innerText();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const events = [];
  const coveredCanvasActions = new Set();

  await page.addInitScript(() => {
    localStorage.setItem('opportunity-os-email-stub', 'true');
  });

  page.on('console', (message) => events.push(`console:${message.type()}:${message.text()}`));
  page.on('pageerror', (error) => events.push(`pageerror:${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      events.push(`http:${response.status()}:${response.url()}`);
    }
  });

  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Create test user' }).click();
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await page.locator('.conductor-pane').waitFor({ timeout: 20000 });

  await sendConductorMessage(
    page,
    'I want to promote my AI-Native Software Engineering book to university software engineering professors. Help me shape the first outreach campaign.',
  );
  const proposalResponse = await sendConductorMessage(
    page,
    'Yes, that is the objective. Set up the first campaign around outreach to software engineering professors.',
  );
  const proposalJson = await proposalResponse.json();
  if (proposalJson.suggestedAction !== 'PROPOSE_GOAL') {
    throw new Error(`Expected PROPOSE_GOAL, received ${proposalJson.suggestedAction ?? 'none'}`);
  }

  await page.waitForSelector('text=Goal proposal is ready', { timeout: 20000 });
  coveredCanvasActions.add(await readCanvasAction(page));

  const previewResponse = await clickAndWaitForApi(page, 'Preview plan', '/ai/preview-strategic-plan');
  const previewJson = await previewResponse.json();
  await page.waitForSelector('text=First cycle', { timeout: 20000 });

  const finalizeResponse = await clickAndWaitForApi(page, 'Confirm goal', '/ai/finalize-strategic-goal');
  const finalizeJson = await finalizeResponse.json();
  await page.waitForSelector('text=Goal and campaign created', { timeout: 20000 });
  await page.waitForSelector('text=Review Opportunity', { timeout: 20000 });
  coveredCanvasActions.add(await readCanvasAction(page));
  await page.waitForSelector('.signal-card', { timeout: 20000 });

  const activateResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/workspace/commands'),
    { timeout: 70000 },
  );
  await page.locator('.signal-card').first().getByRole('button', { name: /Activate in Canvas/ }).click();
  const activateResponse = await activateResponsePromise;
  await page.waitForSelector('text=Signal activated', { timeout: 20000 });
  await page.waitForSelector('text=Review Opportunity', { timeout: 20000 });
  coveredCanvasActions.add(await readCanvasAction(page));

  const draftResponse = await clickAndWaitForApi(page, 'Draft outreach', '/outreach/draft/');
  const draftJson = await draftResponse.json();
  await page.waitForSelector('text=Send outreach', { timeout: 20000 });
  coveredCanvasActions.add(await readCanvasAction(page));

  await page.getByRole('button', { name: 'Send outreach' }).click();
  await page.waitForSelector('text=Email recorded', { timeout: 20000 });
  coveredCanvasActions.add(await readCanvasAction(page));
  await page.waitForTimeout(1000);
  const sendNotices = await page.locator('.notice').allInnerTexts();
  const sendRecordedVisible = sendNotices.some((notice) => notice.includes('Email recorded'));
  if (!sendRecordedVisible) {
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    throw new Error(`Stubbed send did not show the success notice. Notices: ${JSON.stringify(sendNotices)}`);
  }

  await page.waitForSelector('text=Complete cycle', { timeout: 20000 });
  const completeResponse = await clickAndWaitForApi(page, 'Complete cycle', '/workspace/commands');
  const completeJson = await completeResponse.json();
  await page.waitForSelector('text=Cycle completed', { timeout: 20000 });
  await page.locator('.draft-workspace').waitFor({ state: 'detached', timeout: 20000 }).catch(() => undefined);
  coveredCanvasActions.add(await readCanvasAction(page));

  const canvasAction = await readCanvasAction(page);
  const subject = await page.locator('.draft-workspace input').inputValue().catch(() => '');
  const recipient = await page.locator('.draft-meta h3').innerText().catch(() => '');
  const notices = await page.locator('.notice').allInnerTexts();
  const metrics = await page.locator('.metric').allInnerTexts();
  const signalCards = await page.locator('.signal-card').count();
  const timelineSteps = await page.locator('.cycle-step').allInnerTexts();

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  await browser.close();

  console.log(JSON.stringify({
    ok: true,
    frontendUrl: FRONTEND_URL,
    proposalSuggestedAction: proposalJson.suggestedAction,
    previewStatus: previewResponse.status(),
    previewGoal: previewJson.goal?.title,
    finalizeStatus: finalizeResponse.status(),
    finalizedGoal: finalizeJson.goal?.title,
    finalizedCampaign: finalizeJson.campaign?.title,
    activateStatus: activateResponse.status(),
    draftStatus: draftResponse.status(),
    draftSubject: draftJson.subject,
    visibleSubject: subject,
    recipient,
    sendStatus: 'stubbed',
    sendStubbed: true,
    completeStatus: completeResponse.status(),
    completedCycleStatus: completeJson.status,
    canvasAction,
    coveredCanvasActions: Array.from(coveredCanvasActions),
    timelineSteps,
    signalCards,
    metrics,
    notices,
    events,
    screenshot: SCREENSHOT_PATH,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
