import { prisma } from '../../packages/db/src';

/**
 * GHOST USER LONGITUDINAL AUDIT (HTTP VERSION)
 * Tests: Signup -> Campaign Creation -> Dormancy -> AI Nudge Detection.
 */
async function runGhostUserAudit() {
  const API_URL = process.env.API_URL || 'http://localhost:3002';
  const COHORT_SIZE = 3; 
  const DAYS_TO_SIMULATE = 7;
  
  console.log(`🚀 Launching Ghost User Audit (HTTP Optimized)`);
  console.log(`👥 Cohort Size: ${COHORT_SIZE} (100% Ghost Personas)`);
  console.log(`📅 Duration: ${DAYS_TO_SIMULATE} days`);

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  // 1. Setup Cohort
  const users: any[] = [];
  console.log(`\n🏗️  Initializing Ghost Users...`);
  
  for (let i = 0; i < COHORT_SIZE; i++) {
    const email = `ghost-${i}-${Date.now()}@example.com`;
    const fullName = `Ghost User ${i}`;
    
    // Sign up
    const signupRes = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password123!', fullName }),
    });
    const { accessToken, user } = await signupRes.json() as any;

    // Day 0: Create a Campaign (Simulation mode)
    await fetch(`${API_URL}/campaign-orchestration/campaigns`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${accessToken}`, 
        'Content-Type': 'application/json',
        'X-Nexus-Simulated-Date': startDate.toISOString() 
      },
      body: JSON.stringify({
        title: 'Ghost Campaign',
        objective: 'Test Retention',
        strategicAngle: 'Targeting CEOs',
        priorityScore: 90
      })
    });

    users.push({ id: user.id, email, accessToken });
    process.stdout.write('.');
  }
  console.log(`\n✅ Ghost Users Initialized & Campaign Created.`);

  // 2. The 7-Day Wait (Time Warp)
  console.log(`\n⏳ Simulating 7 Days of Dormancy...`);
  
  for (let day = 0; day < DAYS_TO_SIMULATE; day++) {
    const simulatedDate = new Date(startDate);
    simulatedDate.setDate(startDate.getDate() + day);
    const dateStr = simulatedDate.toISOString();

    // Trigger the Retention Scan on Day 3 and Day 6
    if (day === 3 || day === 6) {
      console.log(`\n🔍 Day ${day}: Running Retention Scan...`);
      
      const scanRes = await fetch(`${API_URL}/simulation/trigger-retention-scan`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Nexus-Simulated-Date': dateStr // Pass the date so internal services are warped
        }
      });
      
      const scanResult = await scanRes.json() as any;
      if (!scanResult.success) {
        console.error(`❌ Scan failed on Day ${day}`);
      }
    } else {
      process.stdout.write('.');
    }
  }

  // 3. Audit the Results
  console.log(`\n\n🧐 Auditing Retention Nudges...`);
  const userIds = users.map(u => u.id);

  // We use direct prisma query for the audit report
  const notifications = await prisma.notification.findMany({
    where: { 
      userId: { in: userIds },
      eventKey: 'engagement.stalled_nudge'
    }
  });

  const stalledSnapshots = await prisma.userLifecycleSnapshot.count({
    where: {
      userId: { in: userIds },
      currentStage: 'stalled'
    }
  });

  console.log(`\n🏆 Audit Results:`);
  console.log(`Total Ghost Users: ${users.length}`);
  console.log(`Users Successfully Flagged as 'Stalled': ${stalledSnapshots}`);
  console.log(`AI Nudges Generated: ${notifications.length}`);

  if (notifications.length > 0) {
    console.log(`\n📝 AI Content Sample (First Nudge):`);
    console.log(`Subject: ${notifications[0].subject}`);
    console.log(`Body: ${notifications[0].body}`);
    console.log(`Status: ${notifications[0].status} (Expected: simulated)`);
  }

  console.log(`\n✅ Ghost User Audit Complete.`);
  process.exit(0);
}

runGhostUserAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
