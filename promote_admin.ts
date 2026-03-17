
import db from './src/lib/db';

async function main() {
    const users = await db.user.findMany();
    console.log("Found users:", users);

    if (users.length === 1) {
        const user = users[0];
        console.log(`Only one user found (${user.email}). Promoting to ADMIN...`);
        await db.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN' }
        });
        console.log("Success! User is now ADMIN.");
    } else if (users.length > 1) {
        console.log("Multiple users found. Please specify which email to promote.");
    } else {
        console.log("No users found. Please register an account first.");
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
