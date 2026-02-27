const mongoose = require('mongoose');
const database = require('./config/database');
const { userRepository } = require('./repositories');

async function testDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await database.connect();
    
    console.log('👥 Testing user repository...');
    const users = await userRepository.find({}, { limit: 5 });
    
    console.log(`✅ Found ${users.length} users in database:`);
    users.forEach(user => {
      console.log(`   - ${user.email} (${user.roleId?.name || 'No role'})`);
    });
    
    console.log('🔍 Testing admin user specifically...');
    const admin = await userRepository.findByEmail('admin@lms.dev');
    if (admin) {
      console.log(`✅ Admin user found: ${admin.firstName} ${admin.lastName}`);
      console.log(`   Role: ${admin.roleId?.displayName || 'Unknown'}`);
      console.log(`   Created: ${admin.createdAt}`);
    } else {
      console.log('❌ Admin user not found');
    }
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  } finally {
    await database.disconnect();
    console.log('📵 Database connection closed');
  }
}

testDatabase();