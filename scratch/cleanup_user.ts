
import { prisma } from '@opportunity-os/db';

async function main() {
  const userId = 'a9819630-3c40-4b9f-8d62-40c1bc0bea14';
  
  console.log(`Starting cleanup for user ${userId}...`);

  try {
    // 1. Connector related
    const connectors = await prisma.userConnector.findMany({ where: { userId } });
    const connectorIds = connectors.map(c => c.id);
    await prisma.connectorCredential.deleteMany({ where: { userConnectorId: { in: connectorIds } } });
    await prisma.userConnector.deleteMany({ where: { userId } });
    
    // 2. Campaign/Cycle related
    await prisma.opportunityCycle.deleteMany({ where: { userId } });
    await prisma.campaign.deleteMany({ where: { userId } });
    await prisma.goal.deleteMany({ where: { userId } });
    
    // 3. Workspace related
    await prisma.workspaceSignal.deleteMany({ where: { userId } });
    await prisma.workspaceCommand.deleteMany({ where: { userId } });
    
    // 4. Conversation related
    const convs = await prisma.aIConversation.findMany({ where: { userId } });
    const convIds = convs.map(c => c.id);
    await prisma.aIConversationMessage.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.aIConversation.deleteMany({ where: { userId } });
    
    // 5. Auth related
    const identities = await prisma.authenticationIdentity.findMany({ where: { userId } });
    const identityIds = identities.map(i => i.id);
    await prisma.credential.deleteMany({ where: { authenticationIdentityId: { in: identityIds } } });
    await prisma.authenticationSession.deleteMany({ where: { userId } });
    await prisma.authenticationIdentity.deleteMany({ where: { userId } });
    
    // 6. Technical / CRM / Commerce
    await prisma.technicalProfile.deleteMany({ where: { userId } });
    
    // 7. Assets / Posture
    await prisma.userAsset.deleteMany({ where: { userId } });
    await prisma.userPosture.deleteMany({ where: { userId } });

    // 8. Core Data (New)
    await prisma.opportunityPerson.deleteMany({ where: { opportunityId: { in: (await prisma.opportunity.findMany({ where: { userId } })).map(o => o.id) } } });
    await prisma.opportunity.deleteMany({ where: { userId } });
    await prisma.person.deleteMany({ where: { userId } });
    await prisma.company.deleteMany({ where: { userId } });
    await prisma.conversationThreadMessage.deleteMany({ where: { threadId: { in: (await prisma.conversationThread.findMany({ where: { userId } })).map(t => t.id) } } });
    await prisma.conversationThread.deleteMany({ where: { userId } });
    
    // 9. Finally the user
    await prisma.user.delete({ where: { id: userId } });

    console.log('Cleanup complete.');
  } catch (e) {
    console.error('Cleanup failed partially, some records might still exist.');
    console.error(e);
  }
}

main().catch(console.error);
