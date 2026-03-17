
import db from './src/lib/db';

async function check() {
    console.log("Checking DB...");
    const slug = 'ai-ha-thanh-inh-ca-trieu-toan-la-thien-co-nguoi-tai-1769572288406';
    const index = 1;

    const story = await db.story.findUnique({
        where: { slug },
        select: { id: true, title: true }
    });

    if (!story) {
        console.log("Story not found!");
        return;
    }
    console.log("Story found:", story.title, story.id);

    const chapter = await db.chapter.findFirst({
        where: { storyId: story.id, index },
    });

    if (!chapter) {
        console.log("Chapter not found!");
    } else {
        console.log("Chapter found:", chapter.title);
        console.log("Content Length:", chapter.content ? chapter.content.length : 0);
        console.log("First 100 chars:", chapter.content ? chapter.content.substring(0, 100) : "NULL");
    }
}

check();
