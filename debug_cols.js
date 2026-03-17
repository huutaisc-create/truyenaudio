const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const story = await prisma.story.findUnique({
        where: { slug: 'phat-mon-ac-the' },
        select: { id: true }
    });

    const cols = ['id', 'index', 'title', 'content', 'viewCount', 'createdAt', 'updatedAt', 'storyId'];
    
    for (const col of cols) {
        try {
            await prisma.chapter.findMany({
                where: { storyId: story.id },
                select: { [col]: true },
                take: 1
            });
            console.log(`OK: ${col}`);
        } catch(e) {
            console.log(`LOI: ${col}`);
        }
    }

    // Test tat ca cot cung luc
    console.log('\nTest tat ca cot...');
    try {
        await prisma.chapter.findMany({
            where: { storyId: story.id },
            select: { id: true, index: true, title: true, content: true, viewCount: true, createdAt: true, updatedAt: true, storyId: true },
            take: 1
        });
        console.log('OK tat ca');
    } catch(e) {
        console.log('LOI tat ca');
    }
}

main().finally(() => prisma.$disconnect());
