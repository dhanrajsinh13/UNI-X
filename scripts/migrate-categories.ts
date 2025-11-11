import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateCategories() {
  try {
    console.log('🔄 Starting category migration...');

    // Mapping old enum values to new ones
    const categoryMapping = {
      'EVENT': 'EVENTS',
      'INTERNSHIP': 'GENERAL', // Map internships to general for now
      'WORKSHOP': 'ACADEMIC',  // Map workshops to academic
      'LIBRARY_MEMORY': 'GENERAL' // Map library memory to general
    };

    // Get all posts with their current categories
    const posts = await prisma.$queryRaw`
      SELECT id, category FROM "Post" 
    `;

    console.log(`📊 Found ${(posts as any[]).length} posts to migrate`);

    // Update each post's category using raw SQL to bypass enum constraints
    for (const mapping of Object.entries(categoryMapping)) {
      const [oldCategory, newCategory] = mapping;
      
      const result = await prisma.$executeRaw`
        UPDATE "Post" SET category = ${newCategory}
        WHERE category::text = ${oldCategory}
      `;
      
      console.log(`✅ Updated ${result} posts from ${oldCategory} to ${newCategory}`);
    }

    console.log('🎉 Category migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateCategories()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });