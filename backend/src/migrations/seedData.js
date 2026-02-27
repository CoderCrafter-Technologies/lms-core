const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const database = require('../config/database');
const { roleRepository, permissionRepository, userRepository } = require('../repositories');

/**
 * Seed database with initial data
 */
class DataSeeder {
  async run() {
    try {
      console.log('🌱 Starting database seeding...');
      
      // Connect to database
      await database.connect();
      
      // Seed roles
      await this.seedRoles();
      
      // Seed permissions
      await this.seedPermissions();
      
      // Seed admin user
      await this.seedAdminUser();
      
      console.log('✅ Database seeding completed successfully!');
      
    } catch (error) {
      console.error('❌ Database seeding failed:', error);
      throw error;
    } finally {
      await database.disconnect();
    }
  }

  async seedRoles() {
    console.log('📝 Seeding roles...');
    
    const roles = await roleRepository.createDefaultRoles();
    
    if (roles.length > 0) {
      console.log(`✅ Created ${roles.length} roles:`, roles.map(r => r.name).join(', '));
    } else {
      console.log('ℹ️  All roles already exist');
    }
  }

  async seedPermissions() {
    console.log('🔐 Seeding permissions...');
    
    const permissions = await permissionRepository.createDefaultPermissions();
    
    if (permissions.length > 0) {
      console.log(`✅ Created ${permissions.length} permissions`);
    } else {
      console.log('ℹ️  All permissions already exist');
    }
  }

  async seedAdminUser() {
    console.log('👤 Seeding admin user...');
    
    // Check if admin user already exists
    const existingAdmin = await userRepository.findByEmail('admin@lms.dev');
    
    if (existingAdmin) {
      console.log('ℹ️  Admin user already exists');
      return;
    }

    // Get admin role
    const adminRole = await roleRepository.findByName('ADMIN');
    if (!adminRole) {
      throw new Error('Admin role not found. Make sure roles are seeded first.');
    }

    // Create admin user
    const adminData = {
      email: 'admin@lms.dev',
      password: 'Admin123!',
      firstName: 'System',
      lastName: 'Administrator',
      isEmailVerified: true,
      isActive: true
    };

    const admin = await userRepository.createWithRole(adminData, adminRole.id);
    
    console.log(`✅ Created admin user: ${admin.email}`);
    console.log('📋 Admin credentials:');
    console.log('   Email: admin@lms.dev');
    console.log('   Password: Admin123!');
    console.log('⚠️  Please change the admin password after first login!');
  }

  // Additional seed methods for development data
  async seedDevelopmentData() {
    console.log('🔧 Seeding development data...');
    
    await this.seedSampleUsers();
    await this.seedSampleCourses();
  }

  async seedSampleUsers() {
    console.log('👥 Creating sample users...');
    
    const roles = await roleRepository.findActive();
    const roleMap = {};
    roles.forEach(role => {
      roleMap[role.name] = role.id;
    });

    const sampleUsers = [
      {
        email: 'manager@lms.dev',
        password: 'Manager123!',
        firstName: 'John',
        lastName: 'Manager',
        roleId: roleMap['MANAGER']
      },
      {
        email: 'instructor@lms.dev',
        password: 'Instructor123!',
        firstName: 'Jane',
        lastName: 'Instructor',
        roleId: roleMap['INSTRUCTOR']
      },
      {
        email: 'student@lms.dev',
        password: 'Student123!',
        firstName: 'Bob',
        lastName: 'Student',
        roleId: roleMap['STUDENT']
      }
    ];

    for (const userData of sampleUsers) {
      const existing = await userRepository.findByEmail(userData.email);
      if (!existing) {
        await userRepository.create(userData);
        console.log(`✅ Created user: ${userData.email}`);
      }
    }
  }

  async seedSampleCourses() {
    // This would create sample courses, batches, etc.
    // For now, we'll skip this to keep the seed simple
    console.log('ℹ️  Sample courses seeding skipped for now');
  }
}

// Run seeder if called directly
if (require.main === module) {
  const seeder = new DataSeeder();
  
  seeder.run()
    .then(() => {
      console.log('🎉 Seeding process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding process failed:', error);
      process.exit(1);
    });
}

module.exports = DataSeeder;