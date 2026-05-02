import { prisma, ReferralMilestoneType } from '../../packages/db/src';

/**
 * VIRAL CREDIT INFLATION AUDIT
 * Tests: Mass Referrals -> Credit Accumulation -> Usage Depletion.
 */
async function runViralCreditAudit() {
  const API_URL = process.env.API_URL || 'http://localhost:3002';
  const REFERRAL_COUNT = 20;
  
  console.log(`🚀 Launching Viral Credit Inflation Audit`);
  console.log(`📈 Target: ${REFERRAL_COUNT} Paid Conversions for one Referrer`);

  // 1. Setup Power Referrer
  const referrerEmail = `power-referrer-${Date.now()}@example.com`;
  const signupRes = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: referrerEmail, password: 'Password123!', fullName: 'Power Referrer' }),
  });
  const { user: referrer, accessToken: referrerToken } = await signupRes.json() as any;
  
  // Upgrade to Pro
  await fetch(`${API_URL}/simulation/force-upgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: referrer.id, planCode: 'pro' }),
  });

  // Trigger referral link creation via seeding
  await fetch(`${API_URL}/simulation/seed-user-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: referrer.id }),
  });

  // Get their referral code
  const referralLink = await prisma.referralLink.findFirst({ where: { userId: referrer.id } });
  const refCode = referralLink?.code;
  
  if (!refCode) {
    console.error('❌ Failed to generate referral code.');
    process.exit(1);
  }
  
  console.log(`✅ Power Referrer Created. Code: ${refCode}`);

  // 2. Simulate 20 Paid Referrals
  console.log(`\n🏗️  Generating ${REFERRAL_COUNT} Paid Referrals...`);
  
  for (let i = 0; i < REFERRAL_COUNT; i++) {
    const referredEmail = `referred-${i}-${Date.now()}@example.com`;
    
    // Sign up with referral code
    const refSignupRes = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: referredEmail, 
        password: 'Password123!', 
        fullName: `Referred User ${i}`,
        referralCode: refCode 
      }),
    });
    const { user: referred } = await refSignupRes.json() as any;

    // Trigger Paid Conversion Milestone
    // We use a mock endpoint if available, or trigger it via CommercialService
    // Since we're in a script, we'll call the simulation endpoint to 'seed' the conversion
    // But wait, we need to record the milestone properly to trigger rewards.
    
    // Let's manually trigger the milestone record via the API if we had an endpoint.
    // For now, we'll use prisma to force the milestone which triggers the reward logic 
    // if the service was listening (but milestones are recorded in CommercialService).
    
    // Actually, I'll trigger it via a new simulation endpoint 'record-referral-milestone'
    await fetch(`${API_URL}/simulation/record-referral-milestone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: referred.id,
        milestoneType: 'paid_conversion'
      })
    });

    process.stdout.write('.');
  }
  console.log(`\n✅ ${REFERRAL_COUNT} Referrals Processed.`);

  // 3. Audit Accumulated Credits
  console.log(`\n🧐 Auditing Accumulated Credits for Referrer...`);
  
  const credits = await prisma.growthCredit.findMany({
    where: { userId: referrer.id }
  });

  const totalGranted = credits.reduce((sum, c) => sum + c.quantityGranted, 0);
  console.log(`💰 Total Credits Granted: ${totalGranted} (Expected: ${REFERRAL_COUNT * 100})`);

  // 4. Simulate Mass Usage
  const USAGE_TO_SIMULATE = 2100;
  console.log(`\n⚡ Simulating ${USAGE_TO_SIMULATE} AI Actions for Referrer...`);
  
  // We'll call an endpoint that increments usage
  // We'll use a loop to simulate the load
  for (let j = 0; j < 21; j++) {
    await fetch(`${API_URL}/simulation/increment-usage-batch`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        userId: referrer.id,
        featureKey: 'AI_CREDITS_MONTHLY',
        quantity: 100
      })
    });
    process.stdout.write('.');
  }

  // 5. Final Audit
  console.log(`\n\n🏆 Final Audit Results:`);
  
  const finalCredits = await prisma.growthCredit.findMany({
    where: { userId: referrer.id }
  });
  
  const remainingCredits = finalCredits.reduce((sum, c) => sum + (c.quantityGranted - c.quantityUsed), 0);
  const totalUsed = finalCredits.reduce((sum, c) => sum + c.quantityUsed, 0);
  
  const usageCounter = await prisma.usageCounter.findFirst({
    where: { userId: referrer.id, featureKey: 'AI_CREDITS_MONTHLY' }
  });

  console.log(`Credits Remaining: ${remainingCredits}`);
  console.log(`Credits Consumed: ${totalUsed}`);
  console.log(`Total Usage Counter: ${usageCounter?.usedCount}`);

  if (remainingCredits === 0 && totalUsed >= 2000) {
    console.log(`\n✅ Economy Stabilized: Credits depleted before over-usage.`);
  } else if (remainingCredits > 0) {
    console.log(`\n⚠️  Inflation Alert: User still has ${remainingCredits} credits after ${USAGE_TO_SIMULATE} actions.`);
  }

  console.log(`\n✅ Viral Credit Audit Complete.`);
  process.exit(0);
}

runViralCreditAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
