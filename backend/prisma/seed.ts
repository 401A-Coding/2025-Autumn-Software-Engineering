import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const username = (process.env.ADMIN_USERNAME || '').trim();
    const phone = (process.env.ADMIN_PHONE || '').trim();
    const password = process.env.ADMIN_PASSWORD; // do not trim passwords
    const force = String(process.env.FORCE_SEED || '').toLowerCase() === 'true';

    if (!username || !phone || !password) {
        console.error('Missing ADMIN_USERNAME, ADMIN_PHONE or ADMIN_PASSWORD env vars.');
        process.exit(1);
    }

    if (process.env.NODE_ENV === 'production' && !force) {
        console.error('Refusing to run seed in production without FORCE_SEED=true');
        process.exit(1);
    }

    const existing = await prisma.user.findUnique({ where: { username } });

    const saltRounds = 12;
    const hashed = await bcrypt.hash(password, saltRounds);

    if (existing) {
        if (!force) {
            console.log(`Admin user '${username}' already exists — skipping (use FORCE_SEED=true to override).`);
            return;
        }

        await prisma.user.update({
            where: { id: existing.id },
            data: { password: hashed, phone, role: 'ADMIN' },
        });

        console.log(`Admin user '${username}' updated (password rotated).`);
        try {
            await prisma.adminActionLog.create({
                data: {
                    adminId: existing.id,
                    action: 'seed_update',
                    targetType: 'USER',
                    targetId: existing.id,
                    payload: { reason: 'seed_rotate' },
                },
            });
        } catch (e) {
            console.error('Failed to write admin action log:', e);
        }
        return;
    }

    await prisma.user.create({
        data: {
            username,
            phone,
            password: hashed,
            role: 'ADMIN',
        },
    });
    console.log(`Admin user '${username}' created.`);
    try {
        // write audit
        const created = await prisma.user.findUnique({ where: { username } });
        if (created) {
            await prisma.adminActionLog.create({
                data: {
                    adminId: created.id,
                    action: 'seed_create',
                    targetType: 'USER',
                    targetId: created.id,
                    payload: { note: 'initial_seed' },
                },
            });
        }
    } catch (e) {
        console.error('Failed to write admin action log:', e);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
