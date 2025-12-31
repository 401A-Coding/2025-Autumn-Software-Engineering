import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const username = process.env.ADMIN_USERNAME || '幕后黑手';
    const note = process.env.NOTE || 'seed_missing_audit_fix';

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
        console.error('User not found:', username);
        process.exit(1);
    }

    if (!(prisma as any).adminActionLog) {
        console.error('Prisma client does not contain adminActionLog. Have you run prisma migrate and prisma generate?');
        process.exit(1);
    }

    const log = await (prisma as any).adminActionLog.create({
        data: {
            adminId: user.id,
            action: 'seed_create_fix',
            targetType: 'USER',
            targetId: user.id,
            payload: { note },
        },
    });

    console.log('AdminActionLog created id=', log.id);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
