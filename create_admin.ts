
import db from './src/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
    const email = "admin@gmail.com";
    const password = "admin";
    const hashedPassword = await bcrypt.hash(password, 10);

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
        console.log("Admin user already exists. Updating role to ADMIN...");
        await db.user.update({
            where: { email },
            data: { role: 'ADMIN' }
        });
    } else {
        console.log("Creating default admin user...");
        await db.user.create({
            data: {
                name: "Admin User",
                email,
                password: hashedPassword,
                role: "ADMIN"
            }
        });
    }
    console.log("Done. Login with: admin@gmail.com / admin");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
