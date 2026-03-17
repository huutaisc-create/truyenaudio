const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const story = await prisma.story.findUnique({
        where: { slug: 'phat-mon-ac-the' },
        select: { id: true }
    });

    console.log('Story ID:', story.id);

    // Test tung cot cua chapter
    console.log('\nTest select id only...');
    try {
        const r = await prisma.chapter.findMany({
            where: { storyId: story.id },
            select: { id: true },
            take: 5
        });
        console.log('OK:', r.length, 'chapters');
    } catch(e) { console.log('LOI id:', e.message.split('\n')[0]); }

    console.log('\nTest select title...');
    try {
        const r = await prisma.chapter.findMany({
            where: { storyId: story.id },
            select: { id: true, title: true },
            take: 5
        });
        console.log('OK title');
    } catch(e) { console.log('LOI title:', e.message.split('\n')[0]); }

    console.log('\nTest select content...');
    try {
        const r = await prisma.chapter.findMany({
            where: { storyId: story.id },
            select: { id: true, content: true },
            take: 5
        });
        console.log('OK content');
    } catch(e) { console.log('LOI content:', e.message.split('\n')[0]); }
}

main().finally(() => prisma.$disconnect());
