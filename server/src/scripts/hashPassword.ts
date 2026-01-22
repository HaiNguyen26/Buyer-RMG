import 'dotenv/config';
import { hashPassword } from '../utils/password';

// Script helper để hash password
// Sử dụng: npx tsx src/scripts/hashPassword.ts

async function hashPasswordHelper() {
  const password = 'RMG123@';
  try {
    const hashed = await hashPassword(password);
    console.log('\n✅ Password đã được hash:');
    console.log('\nPassword gốc:', password);
    console.log('\nPassword hash (copy để dùng trong Prisma Studio):');
    console.log(hashed);
    console.log('\n📝 Lưu ý:');
    console.log('   - Copy password hash trên');
    console.log('   - Vào Prisma Studio → Users → Insert row');
    console.log('   - Dán password hash vào field password_hash');
    console.log('   - Điền các field khác (username, email, role, location)');
  } catch (error) {
    console.error('❌ Lỗi:', error);
  }
  process.exit(0);
}

hashPasswordHelper();





