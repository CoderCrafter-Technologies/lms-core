const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5000/api';
const BATCH_ID = '689bbc29ad6921aa3cddc9a4';  // Test batch ID from the issue

async function testAPI() {
    console.log('🧪 Testing Batch API Endpoints...\n');
    
    // Test 1: Get all live classes
    console.log('1️⃣ Testing GET /live-classes');
    try {
        const response = await fetch(`${API_BASE}/live-classes`);
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Success: Found ${data.data?.length || 0} classes`);
        } else {
            console.log(`❌ Failed: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    
    // Test 2: Get live classes by batch
    console.log('\n2️⃣ Testing GET /live-classes/batch/:batchId');
    try {
        const response = await fetch(`${API_BASE}/live-classes/batch/${BATCH_ID}`);
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Success: Found ${data.data?.length || 0} classes for batch`);
            if (data.data?.length > 0) {
                console.log(`   First class: "${data.data[0].title}"`);
            }
        } else {
            console.log(`❌ Failed: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    
    // Test 3: Get batch details
    console.log('\n3️⃣ Testing GET /batches/:batchId');
    try {
        const response = await fetch(`${API_BASE}/batches/${BATCH_ID}`);
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Success: Found batch "${data.data?.name}"`);
        } else {
            console.log(`❌ Failed: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('\n🎯 API Test Complete');
}

// Test if server is running first
fetch(`${API_BASE}/health`)
    .then(response => {
        if (response.ok) {
            console.log('🟢 Server is running');
            testAPI();
        } else {
            console.log('🔴 Server responded with error');
            testAPI(); // Continue anyway
        }
    })
    .catch(() => {
        console.log('🔴 Server is not running on localhost:5000');
        console.log('Please start the backend server with: npm run dev');
    });