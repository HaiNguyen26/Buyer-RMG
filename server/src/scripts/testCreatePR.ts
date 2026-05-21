import 'dotenv/config';
import fetch from 'node-fetch';

async function testCreatePR() {
  try {
    console.log('\n🧪 Testing PR creation API...\n');

    // First, login as requestor
    console.log('1️⃣ Logging in as requestor...');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'requestor',
        password: 'RMG123@',
      }),
    });

    if (!loginRes.ok) {
      console.error('❌ Login failed:', loginRes.status, await loginRes.text());
      return;
    }

    const loginData = await loginRes.json();
    const token = (loginData as any).token;
    console.log('✅ Logged in successfully\n');

    // Test create PR
    console.log('2️⃣ Creating PR...');
    const prData = {
      department: 'IT',
      type: 'PRODUCTION',
      requiredDate: '2026-02-15',
      currency: 'VND',
      tax: 10,
      notes: 'Test PR from script',
      items: [
        {
          description: 'Test Item 1',
          partNo: 'P001',
          spec: 'Test spec',
          manufacturer: 'Test Mfg',
          qty: 10,
          unit: 'pcs',
          unitPrice: 100000,
          purpose: 'Testing',
          remark: 'Test remark',
        },
      ],
      action: 'SAVE',
    };

    console.log('📦 PR Data:', JSON.stringify(prData, null, 2));

    const createRes = await fetch('http://localhost:5000/api/requestor/prs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(prData),
    });

    const resText = await createRes.text();
    console.log('\n📊 Response Status:', createRes.status);
    console.log('📊 Response Body:', resText);

    if (createRes.ok) {
      console.log('\n✅ PR created successfully!');
      const result = JSON.parse(resText);
      console.log('PR Number:', result.prNumber);
      console.log('PR ID:', result.id);
    } else {
      console.log('\n❌ Failed to create PR');
      try {
        const errorData = JSON.parse(resText);
        console.log('Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('Raw error:', resText);
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

testCreatePR();
