const fs = require('fs');
const path = require('path');

console.log('🧹 Starting Forseti cleanup...\n');

// Files and directories to delete
const toDelete = [
  // Unused SVG assets
  'apps/web/public/vercel.svg',
  'apps/web/public/turborepo-light.svg',
  'apps/web/public/turborepo-dark.svg',
  'apps/web/public/next.svg',
  'apps/web/public/window.svg',
  'apps/web/public/globe.svg',
  'apps/web/public/file-text.svg',
  'apps/web/public/tray-icon.png',

  // Unused fonts and CSS
  'apps/web/app/page.module.css',
  'apps/web/app/fonts/GeistMonoVF.woff',
  'apps/web/app/fonts/GeistVF.woff',

  // Empty app directories
  'apps/desktop',
  'apps/mobile',

  // Empty packages
  'packages/auth',

  // Empty prisma at root
  'prisma',

  // Docs app (Turborepo demo)
  'apps/docs',

  // Design system (unused)
  'packages/design-system',

  // Unused assets
  'assets/the-paddock-logo-B898QyZq.png',
  'assets/Figma Design/WhatsApp Image 2025-09-25 at 10.21.42_d87cdab8.jpg',
  'assets/Figma Design/WhatsApp Image 2025-09-25 at 10.21.43_a58f62fb.jpg',
  'assets/track_svg',
  'assets/Figma Design/RaceCircuitSilverstone.svg',
  'assets/tray-icon.png',
  'assets/forseti-logo.png',

  // Unused component
  'apps/web/app/components/DataSync.tsx',
];

let deletedCount = 0;
let skippedCount = 0;

toDelete.forEach((item) => {
  const fullPath = path.join(__dirname, item);

  try {
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`✅ Deleted directory: ${item}`);
      } else {
        fs.unlinkSync(fullPath);
        console.log(`✅ Deleted file: ${item}`);
      }
      deletedCount++;
    } else {
      console.log(`⏭️  Skipped (not found): ${item}`);
      skippedCount++;
    }
  } catch (error) {
    console.error(`❌ Error deleting ${item}:`, error.message);
    skippedCount++;
  }
});

console.log(`\n📊 Cleanup Summary:`);
console.log(`   Deleted: ${deletedCount}`);
console.log(`   Skipped: ${skippedCount}`);
console.log(`\n✨ Cleanup complete!`);
console.log('\n📦 Next steps:');
console.log('   1. Run "npm install" in apps/web to update dependencies');
console.log('   2. Manually remove these from package.json files:');
console.log('      - apps/web/package.json: @next/font, @supabase/supabase-js, @repo/ui');
console.log('      - apps/electron/package.json: electron-store (and remove Store usage from main.js)');
