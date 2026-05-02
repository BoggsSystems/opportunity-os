import { prisma, SubscriptionStatus } from '../../packages/db/src';

/**
 * CHURN DEFLECTOR LONGITUDINAL AUDIT
 * Tests: Trial Signup -> Expiration Detection -> AI "Save" Offer.
 */
async function runChurnDeflectorAudit() {
  const API_URL = process.env.API_URL || 'http://localhost:3002';
  
  console.log(`🚀 Launching Churn Deflector Audit`);
  console.log(`🛡️  Target: Trialing users with 3 days remaining`);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // 1. Setup Churn Risk User
  const email = `churn-risk-${Date.now()}@example.com`;
  const fullName = `Churn Risk User`;
  
  console.log(`\n🏗️  Initializing Churn Risk User: ${email}`);
  
  // Sign up
  const signupRes = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!', fullName }),
  });
  const { user } = await signupRes.json() as any;

  // 2. Manually craft an expiring trial in the DB
  // We need a Plan first
  const plan = await prisma.plan.findFirst({ where: { code: 'pro' } });
  if (!plan) {
    console.error('❌ Pro plan not found. Please seed the DB.');
    process.exit(1);
  }

  // Create a trialing subscription that started 11 days ago
  const startedAt = new Date(now);
  startedAt.setDate(now.getDate() - 11);
  
  const currentPeriodEnd = new Date(startedAt);
  currentPeriodEnd.setDate(startedAt.getDate() + 14); // 14 day trial

  console.log(`\n📅 Trial Started: ${startedAt.toISOString()}`);
  console.log(`📅 Trial Expires: ${currentPeriodEnd.toISOString()} (In 3 days)`);

  await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      status: SubscriptionStatus.trialing,
      startedAt,
      currentPeriodStart: startedAt,
      currentPeriodEnd,
      provider: 'stripe_mock',
      billingInterval: 'monthly'
    }
  });

  console.log(`✅ Expiring Trial Subscription Created.`);

  // 3. Trigger the Retention Scan
  console.log(`\n🔍 Triggering Churn Deflector Scan...`);
  
  const scanRes = await fetch(`${API_URL}/simulation/trigger-retention-scan`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Nexus-Simulated-Date': now.toISOString() 
    }
  });
  
  const scanResult = await scanRes.json() as any;
  if (!scanResult.success) {
    console.error(`❌ Scan failed.`);
    process.exit(1);
  }

  // 4. Audit the Results
  console.log(`\n🧐 Auditing Save Offers...`);

  const notifications = await prisma.notification.findMany({
    where: { 
      userId: user.id,
      eventKey: 'billing.trial_expiring_offer'
    }
  });

  const engagementLogs = await prisma.userEngagementLog.findMany({
    where: {
      userId: user.id,
      nudgeType: 'churn_deflector_save_offer'
    }
  });

  console.log(`\n🏆 Audit Results:`);
  console.log(`AI Save Offers Generated: ${notifications.length}`);
  console.log(`Engagement Logs Recorded: ${engagementLogs.length}`);

  if (notifications.length > 0) {
    console.log(`\n📝 AI Save Offer Content:`);
    console.log(`Subject: ${notifications[0].subject}`);
    console.log(`Body: ${notifications[0].body}`);
    console.log(`Status: ${notifications[0].status} (Expected: simulated)`);
  } else {
    console.log('❌ No offer generated. Check trial expiration logic.');
  }

  console.log(`\n✅ Churn Deflector Audit Complete.`);
  process.exit(0);
}

runChurnDeflectorAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
