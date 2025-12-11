const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "TelemetryPoint" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "activityId" TEXT NOT NULL,
        "pointIndex" INTEGER,
        "timeMs" INTEGER,
        "data" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TelemetryPoint_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE
      );
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "TelemetryPoint_activityId_idx" ON "TelemetryPoint" ("activityId");
    `;

    console.log('TelemetryPoint table ensured');
  } catch (err) {
    console.error('Error creating TelemetryPoint table:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
