
import db from './src/lib/db';

async function main() {
    const email = "admin@gmail.com";
    const user = await db.user.findUnique({ where: { email } });

    if (user) {
        console.log(`CONFIRMED: User ${user.email} exists.`);
        console.log(`Role: ${user.role}`);
        console.log(`Password Hash exists: ${!!user.password}`);
    } else {
        console.log("User NOT FOUND.");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
