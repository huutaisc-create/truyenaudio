const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const story = await prisma.story.findUnique({
        where: { slug: 'phat-mon-ac-the' },
        select: { id: true }
    });

    console.log('Test chapter findMany no select, take 1...');
    try {
        const r = await prisma.chapter.findMany({
            where: { storyId: story.id },
            orderBy: { index: 'asc' },
            take: 1
        });
        console.log('OK:', r[0]?.title);
    } catch(e) { console.log('LOI:', e.message.split('\n')[0]); }

    console.log('\nTest chapter findMany no select, take 10...');
    try {
        const r = await prisma.chapter.findMany({
            where: { storyId: story.id },
            orderBy: { index: 'asc' },
            take: 10
        });
        console.log('OK:', r.length);
    } catch(e) { console.log('LOI:', e.message.split('\n')[0]); }

    console.log('\nTest story include chapters no select, take 1...');
    try {
        const r = await prisma.story.findUnique({
            where: { slug: 'phat-mon-ac-the' },
            include: { chapters: { take: 1, orderBy: { index: 'asc' } } }
        });
        console.log('OK:', r?.chapters[0]?.title);
    } catch(e) { console.log('LOI:', e.message.split('\n')[0]); }

    console.log('\nTest story include chapters no select, take 1, orderBy desc...');
    try {
        const r = await prisma.story.findUnique({
            where: { slug: 'phat-mon-ac-the' },
            include: { chapters: { take: 1, orderBy: { index: 'desc' } } }
        });
        console.log('OK:', r?.chapters[0]?.title);
    } catch(e) { console.log('LOI:', e.message.split('\n')[0]); }
}

main().finally(() => prisma.$disconnect());
