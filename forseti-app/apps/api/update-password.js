const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hash = await bcrypt.hash('demo', 10);

  // Find Jordan's user - SQLite doesn't support case insensitive mode, use contains
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'jordan' } },
        { email: { contains: 'Jordan' } },
        { name: { contains: 'jordan' } },
        { name: { contains: 'Jordan' } },
        { username: { contains: 'jordan' } },
        { username: { contains: 'Jordan' } }
      ]
    },
    select: { id: true, email: true, name: true, username: true }
  });

  console.log('Users found:', users);

  if (users.length === 0) {
    console.log('No user named Jordan found');
    await prisma.$disconnect();
    return;
  }

  // Update password
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash }
    });
    console.log(`Updated password for: ${user.email || user.username}`);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
