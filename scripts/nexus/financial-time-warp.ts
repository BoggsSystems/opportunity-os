import { prisma } from '../../packages/db/src';

async function runFinancialTimeWarp() {
  const API_URL = process.env.API_URL || 'http://localhost:3002';
  const TEST_EMAIL = `financial-warp-jeff-FINAL-${Date.now()}@example.com`;
  const PASSWORD = 'Password123!';
  const RULE_ID = '00000000-0000-4000-a000-000000000005';
  
  console.log(`💰 Starting FINAL Financial Time Warp for ${TEST_EMAIL}`);
  
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);
  startDate.setHours(0, 0, 0, 0);
  
  // 1. Setup User
  const signupRes = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: PASSWORD,
      fullName: 'Final Audit Jeff',
    }),
  });
  
  const { accessToken, user } = await signupRes.json() as any;
  const userId = user.id;
  console.log(`✅ User created [ID: ${userId}]`);

  // 2. Seed Everything
  console.log('🏗️ Seeding Business Context...');
  
  const offering = await prisma.offering.create({
    data: { userId, title: 'AI Transformation', status: 'active', offeringType: 'service' }
  });

  const campaign = await prisma.campaign.create({
    data: { userId, offeringId: offering.id, title: 'Final Financial Campaign', status: 'ACTIVE' }
  });

  const lane = await prisma.actionLane.create({
    data: { campaignId: campaign.id, laneType: 'linkedin_dm', title: 'Outreach', status: 'ACTIVE' }
  });

  const itemData = [];
  for (let i = 0; i < 100; i++) {
    itemData.push({
      userId,
      campaignId: campaign.id,
      actionLaneId: lane.id,
      actionType: 'linkedin_dm',
      title: `Action #${i}`,
      status: 'ready',
      dueAt: new Date(startDate.getTime() + (i / 5) * 24 * 60 * 60 * 1000),
      createdAt: startDate,
    });
  }
  await prisma.actionItem.createMany({ data: itemData });

  await prisma.rewardRule.upsert({
    where: { id: RULE_ID },
    create: {
      id: RULE_ID,
      ruleType: 'TEMPORAL_STREAK',
      triggerType: 'STREAK_HIT',
      rewardType: 'subscription_credit',
      rewardQuantity: 500, // $5.00
      criteriaJson: { streakDays: 5 },
      isActive: true,
    },
    update: { isActive: true }
  });

  await prisma.plan.upsert({
    where: { code: 'PRO_AUDIT' },
    create: { code: 'PRO_AUDIT', name: 'Pro Audit Plan', monthlyPriceCents: 5000, currency: 'usd', isActive: true },
    update: { isActive: true }
  });

  // 3. Simulation March
  for (let day = 0; day < 30; day++) {
    const simulatedDate = new Date(startDate);
    simulatedDate.setDate(startDate.getDate() + day);
    const dateStr = simulatedDate.toISOString();

    // Start trial on DAY 0
    if (day === 0) await fireWebhook(API_URL, dateStr, { type: 'customer.subscription.created', data: { object: { customer: `cus_${userId}`, id: `sub_${userId}`, status: 'trialing', metadata: { userId, planCode: 'PRO_AUDIT' }}}});
    
    // Complete 5 actions every day
    const qRes = await fetch(`${API_URL}/command-queue/today`, { headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Nexus-Simulated-Date': dateStr }});
    const queue = await qRes.json() as any;
    const items = (queue.items || []).filter((i: any) => i.status !== 'completed').slice(0, 5);
    
    for (const item of items) {
      await fetch(`${API_URL}/command-queue/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'X-Nexus-Simulated-Date': dateStr },
        body: JSON.stringify({ status: 'completed' }),
      });
    }
    
    process.stdout.write('.');
  }

  // 4. Audit
  console.log('\n🧐 Final Audit...');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Sleep to ensure DB consistency

  const finalDate = new Date(startDate);
  finalDate.setDate(startDate.getDate() + 29);
  const finalDateStr = finalDate.toISOString();

  const galleryRes = await fetch(`${API_URL}/rewards/gallery`, { headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Nexus-Simulated-Date': finalDateStr }});
  const gallery = await galleryRes.json() as any;

  // Check BillingEvents via API if possible, or DB as fallback
  const credits = await prisma.billingEvent.findMany({ where: { userId, eventType: 'customer.balance_adjustment' }});

  console.log(`\n🏆 Final Financial Time Warp Results:`);
  console.log(`User ID: ${userId}`);
  console.log(`Streak Recorded: ${gallery.streak} days`);
  console.log(`Financial Credits in DB: ${credits.length}`);
  
  if (credits.length > 0) {
    console.log(`✅ SUCCESS: Financial Time Warp Verified!`);
    console.log(`Total Credit: $${(credits.reduce((sum, c) => sum + (c.payloadJson as any).amountCents, 0) / 100).toFixed(2)}`);
  } else {
    console.log(`❌ FAILURE: Credits not found in DB for user ${userId}`);
  }
}

async function fireWebhook(apiUrl: string, dateStr: string, payload: any) {
  payload.id = `evt_${Math.random().toString(36).substr(2, 9)}`;
  await fetch(`${apiUrl}/billing/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Nexus-Simulated-Date': dateStr },
    body: JSON.stringify(payload),
  });
}

runFinancialTimeWarp().catch(console.error);
