const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const FormData = require('form-data');
const config = require('../apps/api/config');

(async () => {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      console.error('No user found in DB');
      process.exit(1);
    }
    console.log('Using user', user.id, user.email);

    // Find an activity for the user or create one
    let activity = await prisma.activity.findFirst({ where: { userId: user.id } });
    if (!activity) {
      activity = await prisma.activity.create({ data: { userId: user.id, game: 'Test', duration: 10, performance: '100%', date: new Date() } });
    }
    console.log('Using activity', activity.id);

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, config.jwt.secret);

    // Create a small CSV file
    const csvPath = path.join(__dirname, 'tmp-telemetry.csv');
    const content = 'pointIndex,timeMs,speed,rpm\n0,0,30,3000\n1,1000,31,3200\n2,2000,29,3100\n';
    fs.writeFileSync(csvPath, content);

    // Upload via fetch
    const form = new FormData();
    form.append('activityId', activity.id);
    form.append('telemetryFile', fs.createReadStream(csvPath));

    const resp = await fetch('http://localhost:4000/api/telemetry/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    const json = await resp.json();
    console.log('Upload response:', resp.status, json);

    // cleanup
    fs.unlinkSync(csvPath);
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
