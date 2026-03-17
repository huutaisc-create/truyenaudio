import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const stories = await prisma.story.findMany({
        where: { coverImage: { startsWith: '/api/uploads/' } },
        select: { id: true, coverImage: true, title: true },
    });

    console.log(`Tìm thấy ${stories.length} story cần update`);

    let updated = 0;
    for (const story of stories) {
        const newUrl = story.coverImage!.replace('/api/uploads/', '/uploads/');
        await prisma.story.update({
            where: { id: story.id },
            data: { coverImage: newUrl },
        });
        console.log(`✓ ${story.title}: ${story.coverImage} → ${newUrl}`);
        updated++;
    }

    const users = await prisma.user.findMany({
        where: { image: { startsWith: '/api/uploads/' } },
        select: { id: true, image: true, name: true },
    });

    console.log(`\nTìm thấy ${users.length} user avatar cần update`);

    for (const user of users) {
        const newUrl = user.image!.replace('/api/uploads/', '/uploads/');
        await prisma.user.update({
            where: { id: user.id },
            data: { image: newUrl },
        });
        console.log(`✓ ${user.name}: ${user.image} → ${newUrl}`);
        updated++;
    }

    console.log(`\nHoàn thành! Đã update ${updated} records.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
