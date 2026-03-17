const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const story = await prisma.story.findUnique({
        where: { slug: 'phat-mon-ac-the' },
        select: { id: true, _count: { select: { chapters: true } } }
    });

    console.log('Story ID:', story.id);
    console.log('Total chapters:', story._count.chapters);

    // Test tung batch 50 chapters
    const batchSize = 50;
    let skip = 0;
    
    while (true) {
        try {
            const r = await prisma.chapter.findMany({
                where: { storyId: story.id },
                select: { id: true, index: true, content: true },
                orderBy: { index: 'asc' },
                take: batchSize,
                skip: skip
            });
            if (r.length === 0) {
                console.log('Done! Tat ca chapters ok.');
                break;
            }
            console.log(`OK: skip=${skip} to ${skip + r.length}`);
            skip += batchSize;
        } catch(e) {
            console.log(`LOI tai skip=${skip} den ${skip + batchSize}`);
            // Thu tung cai
            for (let i = skip; i < skip + batchSize; i++) {
                try {
                    const r = await prisma.chapter.findMany({
                        where: { storyId: story.id },
                        select: { id: true, index: true },
                        orderBy: { index: 'asc' },
                        take: 1,
                        skip: i
                    });
                    if (r.length === 0) break;
                } catch(e2) {
                    console.log(`  LOI chapter tai index offset=${i}`);
                }
            }
            skip += batchSize;
        }
    }
}

main().finally(() => prisma.$disconnect());
