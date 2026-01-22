import 'dotenv/config';
import { prisma } from '../config/database';

/**
 * Migration script to update ApprovalRule model:
 * - Rename branchDirectorRequired to needBranchManager
 * - Remove teamLeadRequired (always true, not needed)
 */
async function migrateApprovalRuleField() {
  console.log('\n🔄 ========== MIGRATE APPROVAL RULE FIELD ==========');
  console.log('🔄 Migrating branchDirectorRequired → needBranchManager');
  console.log('🔄 Removing teamLeadRequired (always true)');

  try {
    // Use raw SQL to rename column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE approval_rules 
      RENAME COLUMN branch_director_required TO need_branch_manager;
    `);

    console.log('✅ Column renamed successfully');

    // Drop team_lead_required column (always true, not needed)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE approval_rules 
      DROP COLUMN IF EXISTS team_lead_required;
    `);

    console.log('✅ Removed team_lead_required column');

    // Verify migration
    const rules = await prisma.$queryRawUnsafe(`
      SELECT id, department_code, pr_type, need_branch_manager, status 
      FROM approval_rules 
      LIMIT 5;
    `);

    console.log('\n📊 Sample data after migration:');
    console.log(JSON.stringify(rules, null, 2));

    console.log('\n✅ Migration completed successfully!');
    console.log('🔄 =========================================\n');
  } catch (error: any) {
    console.error('❌ Migration error:', error);
    
    // If column already renamed, that's okay
    if (error.message?.includes('does not exist') || error.message?.includes('already exists')) {
      console.log('⚠️ Column may have already been migrated. Checking current state...');
      
      try {
        const checkColumn = await prisma.$queryRawUnsafe(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'approval_rules' 
          AND column_name IN ('branch_director_required', 'need_branch_manager', 'team_lead_required');
        `);
        console.log('📊 Current columns:', checkColumn);
      } catch (checkError: any) {
        console.error('❌ Error checking columns:', checkError);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

migrateApprovalRuleField();




