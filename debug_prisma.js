const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Test 1: chi lay id va title
    console.log('Test 1: select id, title...');
    try {
        const r = await prisma.story.findUnique({
            where: { slug: 'phat-mon-ac-the' },
            select: { id: true, title: true }
        });
        console.log('OK:', r);
    } catch (e) {
        console.log('LOI:', e.message);
    }

    // Test 2: lay them description
    console.log('\nTest 2: + description...');
    try {
        const r = await prisma.story.findUnique({
            where: { slug: 'phat-mon-ac-the' },
            select: { id: true, title: true, description: true }
        });
        console.log('OK:', r?.title);
    } catch (e) {
        console.log('LOI:', e.message);
    }

    // Test 3: full story
    console.log('\nTest 3: full story...');
    try {
        const r = await prisma.story.findUnique({
            where: { slug: 'phat-mon-ac-the' },
        });
        console.log('OK:', r?.title);
    } catch (e) {
        console.log('LOI:', e.message);
    }

    // Test 4: lay chapters
    console.log('\nTest 4: chapters...');
    try {
        const r = await prisma.story.findUnique({
            where: { slug: 'phat-mon-ac-the' },
            include: { chapters: { take: 1 } }
        });
        console.log('OK chapters:', r?.chapters?.length);
    } catch (e) {
        console.log('LOI:', e.message);
    }
}

main().finally(() => prisma.$disconnect());
