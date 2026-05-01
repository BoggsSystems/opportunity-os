import { prisma } from '@opportunity-os/db';

async function runTimeWarpTest() {
  const API_URL = process.env.API_URL || 'http://localhost:3002';
  const TEST_EMAIL = 'time-warp-jeff@example.com';
  const PASSWORD = 'Password123!';
  
  console.log(`🚀 Starting Time Warp Test for ${TEST_EMAIL}`);
  
  // 1. Setup User
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  
  const signupRes = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: PASSWORD,
      fullName: 'Time Warp Jeff',
    }),
  });
  
  if (!signupRes.ok) {
    console.error('Signup failed', await signupRes.text());
    process.exit(1);
  }
  
  const { accessToken } = await signupRes.json() as any;
  console.log('✅ User created and logged in.');

  // 2. March through the year
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);
  startDate.setHours(0, 0, 0, 0);

  let currentStreak = 0;
  let totalCredits = 0;

  for (let day = 0; day < 365; day++) {
    const simulatedDate = new Date(startDate);
    simulatedDate.setDate(startDate.getDate() + day);
    const dateStr = simulatedDate.toISOString();

    // A. Get Today's Queue (triggers generation)
    const queueRes = await fetch(`${API_URL}/command-queue/today`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Nexus-Simulated-Date': dateStr,
      },
    });
    
    if (!queueRes.ok) {
      console.error(`Failed to get queue for ${dateStr}`, await queueRes.text());
      continue;
    }
    
    const queue = await queueRes.json() as any;
    const items = queue.items || [];

    // B. Complete 5 items to trigger Daily Quota & Streak
    const toComplete = items.slice(0, 5);
    for (const item of toComplete) {
      await fetch(`${API_URL}/command-queue/items/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Nexus-Simulated-Date': dateStr,
        },
        body: JSON.stringify({ status: 'completed' }),
      });
    }

    // C. Every month, check progress
    if ((day + 1) % 30 === 0) {
      const galleryRes = await fetch(`${API_URL}/rewards/gallery`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Nexus-Simulated-Date': dateStr,
        },
      });
      const gallery = await galleryRes.json() as any;
      
      const creditsRes = await fetch(`${API_URL}/commercial/usage/credits`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Nexus-Simulated-Date': dateStr,
        },
      });
      const credits = await creditsRes.json() as any;
      
      currentStreak = gallery.streak;
      totalCredits = credits.availableCredits || 0;

      console.log(`📅 Month ${Math.floor(day / 30) + 1} | Date: ${simulatedDate.toDateString()} | Streak: ${currentStreak} days | AI Credits: ${totalCredits}`);
    }
  }

  console.log('\n🏆 Time Warp Test Completed!');
  console.log(`Final Streak: ${currentStreak} days`);
  console.log(`Final AI Credit Balance: ${totalCredits}`);
}

runTimeWarpTest().catch(console.error);
