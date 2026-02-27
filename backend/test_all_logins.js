const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testAllLogins() {
  console.log('🧪 Testing All User Logins...\n');

  const testAccounts = [
    {
      email: 'admin@lmsfutureproof.com',
      password: 'admin123456',
      role: 'Admin'
    },
    {
      email: 'instructor@lmsfutureproof.com',
      password: 'instructor123',
      role: 'Instructor'
    },
    {
      email: 'instructor1@lmsfutureproof.com',
      password: 'instructor123',
      role: 'Instructor 1'
    },
    {
      email: 'instructor2@lmsfutureproof.com',
      password: 'instructor123',
      role: 'Instructor 2'
    },
    {
      email: 'student@lmsfutureproof.com',
      password: 'student123',
      role: 'Student'
    },
    {
      email: 'student1@lmsfutureproof.com',
      password: 'student123',
      role: 'Student 1'
    }
  ];

  for (const account of testAccounts) {
    try {
      console.log(`🔐 Testing login for ${account.role}...`);
      
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: account.email,
        password: account.password
      });

      if (response.status === 200) {
        const userData = response.data;
        console.log(`   ✅ LOGIN SUCCESS`);
        console.log(`   👤 Name: ${userData.user.firstName} ${userData.user.lastName}`);
        console.log(`   📧 Email: ${userData.user.email}`);
        console.log(`   🎭 Role: ${userData.user.role.displayName}`);
        console.log(`   🔑 Token: ${userData.token ? 'Generated' : 'Missing'}`);
        console.log(`   📊 User ID: ${userData.user.id}`);
      }
    } catch (error) {
      console.log(`   ❌ LOGIN FAILED`);
      if (error.response) {
        console.log(`   📝 Error: ${error.response.data.message || 'Unknown error'}`);
        console.log(`   🔢 Status: ${error.response.status}`);
      } else {
        console.log(`   📝 Error: ${error.message}`);
      }
    }
    console.log('   ──────────────────────────────────────────────────');
  }

  console.log('\n🎯 SUMMARY:');
  console.log('If all logins show ✅ SUCCESS, all accounts are working correctly.');
  console.log('If any show ❌ FAILED, those accounts need password reset.\n');

  console.log('🔗 FRONTEND TESTING:');
  console.log('• Frontend: http://localhost:3000/login');
  console.log('• Try logging in with any of the accounts above');
  console.log('• Check instructor profile navigation works');
  console.log('• Test admin panel instructor section');
}

// Run the test
testAllLogins();