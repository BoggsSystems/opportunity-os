"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("@opportunity-os/db");
async function main() {
    const users = await db_1.prisma.user.findMany({
        select: { id: true, email: true, fullName: true }
    });
    console.log(JSON.stringify(users, null, 2));
}
main().catch(console.error);
//# sourceMappingURL=list_users.js.map