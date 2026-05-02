"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("@opportunity-os/db");
async function main() {
    const userId = 'a9819630-3c40-4b9f-8d62-40c1bc0bea14';
    console.log(`Starting cleanup for user ${userId}...`);
    try {
        const connectors = await db_1.prisma.userConnector.findMany({ where: { userId } });
        const connectorIds = connectors.map(c => c.id);
        await db_1.prisma.connectorCredential.deleteMany({ where: { userConnectorId: { in: connectorIds } } });
        await db_1.prisma.userConnector.deleteMany({ where: { userId } });
        await db_1.prisma.opportunityCycle.deleteMany({ where: { userId } });
        await db_1.prisma.campaign.deleteMany({ where: { userId } });
        await db_1.prisma.goal.deleteMany({ where: { userId } });
        await db_1.prisma.workspaceSignal.deleteMany({ where: { userId } });
        await db_1.prisma.workspaceCommand.deleteMany({ where: { userId } });
        const convs = await db_1.prisma.aIConversation.findMany({ where: { userId } });
        const convIds = convs.map(c => c.id);
        await db_1.prisma.aIConversationMessage.deleteMany({ where: { conversationId: { in: convIds } } });
        await db_1.prisma.aIConversation.deleteMany({ where: { userId } });
        const identities = await db_1.prisma.authenticationIdentity.findMany({ where: { userId } });
        const identityIds = identities.map(i => i.id);
        await db_1.prisma.credential.deleteMany({ where: { authenticationIdentityId: { in: identityIds } } });
        await db_1.prisma.authenticationSession.deleteMany({ where: { userId } });
        await db_1.prisma.authenticationIdentity.deleteMany({ where: { userId } });
        await db_1.prisma.technicalProfile.deleteMany({ where: { userId } });
        await db_1.prisma.userAsset.deleteMany({ where: { userId } });
        await db_1.prisma.userPosture.deleteMany({ where: { userId } });
        await db_1.prisma.opportunityPerson.deleteMany({ where: { opportunityId: { in: (await db_1.prisma.opportunity.findMany({ where: { userId } })).map(o => o.id) } } });
        await db_1.prisma.opportunity.deleteMany({ where: { userId } });
        await db_1.prisma.person.deleteMany({ where: { userId } });
        await db_1.prisma.company.deleteMany({ where: { userId } });
        await db_1.prisma.conversationThreadMessage.deleteMany({ where: { threadId: { in: (await db_1.prisma.conversationThread.findMany({ where: { userId } })).map(t => t.id) } } });
        await db_1.prisma.conversationThread.deleteMany({ where: { userId } });
        await db_1.prisma.user.delete({ where: { id: userId } });
        console.log('Cleanup complete.');
    }
    catch (e) {
        console.error('Cleanup failed partially, some records might still exist.');
        console.error(e);
    }
}
main().catch(console.error);
//# sourceMappingURL=cleanup_user.js.map