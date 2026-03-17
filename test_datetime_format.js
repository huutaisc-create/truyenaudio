const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Lay story id bat ky
    const story = await prisma.story.findFirst({
        select: { id: true }
    });

    console.log('Story:', story.id);

    // Tao chapter test
    const ch = await prisma.chapter.create({
        data: {
            index: 999999,
            title: 'TEST CHAPTER - XOA SAU',
            content: 'test content',
            storyId: story.id,
            updatedAt: new Date(),
        }
    });
    console.log('Created chapter id:', ch.id);
    console.log('updatedAt:', ch.updatedAt);
    console.log('createdAt:', ch.createdAt);

    // Doc lai bang sqlite truc tiep
    const sqlite3 = require('better-sqlite3');
    const db = sqlite3('./prisma/dev.db');
    const row = db.prepare('SELECT createdAt, updatedAt FROM Chapter WHERE id = ?').get(ch.id);
    console.log('\nRaw SQLite createdAt:', row.createdAt);
    console.log('Raw SQLite updatedAt:', row.updatedAt);
    db.close();

    // Xoa chapter test
    await prisma.chapter.delete({ where: { id: ch.id } });
    console.log('\n[+] Da xoa chapter test');
}

main().finally(() => prisma.$disconnect());
