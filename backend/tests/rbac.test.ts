import { createServer } from 'http';
import app from '../src/index.js';
import { seedDatabase } from '../src/db/seed.js';
import db from '../src/db/index.js';

let server: any;
let baseUrl: string;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Starting RUMI RBAC & API Test Suite');
  console.log('========================================\n');

  // 1. Re-seed clean database
  seedDatabase();

  // 2. Start test server on random port
  await new Promise<void>((resolve) => {
    server = createServer(app).listen(0, () => {
      const port = (server.address() as any).port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server active on ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // ----------------------------------------------------
    // TEST 1: Public Endpoints
    // ----------------------------------------------------
    console.log('--- Test 1: Public Endpoints ---');
    const kitsRes = await fetch(`${baseUrl}/api/play-kits`);
    const kitsData = await kitsRes.json();
    assert(kitsRes.status === 200, 'Public can fetch play kits');
    assert(kitsData.play_kits.length >= 4, 'Contains 4+ seeded play kits');

    const classesRes = await fetch(`${baseUrl}/api/classes`);
    const classesData = await classesRes.json();
    assert(classesRes.status === 200, 'Public can fetch classes');
    assert(classesData.classes.length >= 3, 'Contains 3 seeded classes');

    // ----------------------------------------------------
    // TEST 2: Authentication
    // ----------------------------------------------------
    console.log('\n--- Test 2: Authentication ---');
    // Admin login
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@rumi.id', password: 'admin123' })
    });
    const adminData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200, 'Admin login succeeded');
    assert(adminData.user.role === 'admin', 'Admin user role is admin');
    const adminToken = adminData.token;

    // Parent Nadia login
    const nadiaLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nadia@example.com', password: 'parent123' })
    });
    const nadiaData = await nadiaLoginRes.json();
    assert(nadiaLoginRes.status === 200, 'Parent Nadia login succeeded');
    assert(nadiaData.user.role === 'parent', 'Nadia user role is parent');
    const nadiaToken = nadiaData.token;

    // Parent Omar login
    const omarLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'omar@example.com', password: 'parent123' })
    });
    const omarData = await omarLoginRes.json();
    const omarToken = omarData.token;

    // Fetch child IDs from DB
    const amina = db.prepare('SELECT id FROM children WHERE name = ?').get('Amina Rahman') as { id: number };
    const yusuf = db.prepare('SELECT id FROM children WHERE name = ?').get('Yusuf Karim') as { id: number };

    // ----------------------------------------------------
    // TEST 3: Parent Own Data Access
    // ----------------------------------------------------
    console.log('\n--- Test 3: Parent Own Data Access ---');
    const nadiaChildrenRes = await fetch(`${baseUrl}/api/children`, {
      headers: { Authorization: `Bearer ${nadiaToken}` }
    });
    const nadiaChildren = await nadiaChildrenRes.json();
    assert(nadiaChildrenRes.status === 200, 'Nadia can fetch her children');
    assert(nadiaChildren.children.length === 1 && nadiaChildren.children[0].id === amina.id, 'Nadia only sees her child Amina');

    const aminaAssessRes = await fetch(`${baseUrl}/api/assessments?child_id=${amina.id}`, {
      headers: { Authorization: `Bearer ${nadiaToken}` }
    });
    const aminaAssess = await aminaAssessRes.json();
    assert(aminaAssessRes.status === 200, 'Nadia can fetch Amina assessments');
    assert(aminaAssess.assessments.length > 0, 'Amina has assessments');

    const aminaPhotosRes = await fetch(`${baseUrl}/api/photos?child_id=${amina.id}`, {
      headers: { Authorization: `Bearer ${nadiaToken}` }
    });
    const aminaPhotos = await aminaPhotosRes.json();
    assert(aminaPhotosRes.status === 200, 'Nadia can fetch Amina photos');
    assert(aminaPhotos.photos.length > 0, 'Amina has photos');

    // ----------------------------------------------------
    // TEST 4: STRICT RBAC Isolation (Nadia -> Yusuf data)
    // ----------------------------------------------------
    console.log('\n--- Test 4: Strict RBAC Cross-Parent Isolation ---');
    // Nadia accessing Yusuf's profile
    const trespassChildRes = await fetch(`${baseUrl}/api/children/${yusuf.id}`, {
      headers: { Authorization: `Bearer ${nadiaToken}` }
    });
    assert(trespassChildRes.status === 403, 'Nadia CANNOT access Yusuf child record (403 Forbidden)');

    // Nadia accessing Yusuf's assessments
    const trespassAssessRes = await fetch(`${baseUrl}/api/assessments?child_id=${yusuf.id}`, {
      headers: { Authorization: `Bearer ${nadiaToken}` }
    });
    assert(trespassAssessRes.status === 403, 'Nadia CANNOT access Yusuf assessments (403 Forbidden)');

    // Nadia accessing Yusuf's photos
    const trespassPhotosRes = await fetch(`${baseUrl}/api/photos?child_id=${yusuf.id}`, {
      headers: { Authorization: `Bearer ${nadiaToken}` }
    });
    assert(trespassPhotosRes.status === 403, 'Nadia CANNOT access Yusuf photos (403 Forbidden)');

    // Nadia attempting admin operations
    const trespassAdminMetrics = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${nadiaToken}` }
    });
    assert(trespassAdminMetrics.status === 403, 'Nadia CANNOT access Admin Metrics (403 Forbidden)');

    const trespassCreateAssess = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${nadiaToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        child_id: amina.id,
        domain: 'math',
        score: 10
      })
    });
    assert(trespassCreateAssess.status === 403, 'Nadia CANNOT create assessments (403 Forbidden)');

    // ----------------------------------------------------
    // TEST 5: Admin Global Access & Mutation
    // ----------------------------------------------------
    console.log('\n--- Test 5: Admin Privileges ---');
    const adminChildrenRes = await fetch(`${baseUrl}/api/children`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminChildren = await adminChildrenRes.json();
    assert(adminChildrenRes.status === 200, 'Admin can list all children');
    assert(adminChildren.children.length >= 4, 'Admin sees all 4 enrolled children across groups');

    const adminYusufAssess = await fetch(`${baseUrl}/api/assessments?child_id=${yusuf.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminYusufAssess.status === 200, 'Admin can access Yusuf assessments');

    const adminMetricsRes = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const metricsData = await adminMetricsRes.json();
    assert(adminMetricsRes.status === 200, 'Admin can view metrics overview');
    assert(metricsData.metrics.totalEnrolled >= 4, 'Metrics reflect enrolled students');

    // Admin creates new assessment
    const adminPostAssess = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        child_id: yusuf.id,
        domain: 'islamic_studies',
        score: 9,
        notes: 'Demonstrated adab during snack time.'
      })
    });
    assert(adminPostAssess.status === 201, 'Admin can create new assessment for Yusuf');

    // ----------------------------------------------------
    // TEST 6: Parent Orders & Fulfillment
    // ----------------------------------------------------
    console.log('\n--- Test 6: Order Placement & Isolation ---');
    const kit = db.prepare('SELECT id, stock, price FROM play_kits LIMIT 1').get() as { id: number; stock: number; price: number };
    const stockBefore = kit.stock;

    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${nadiaToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{ kit_id: kit.id, quantity: 2, price: kit.price }],
        total_amount: kit.price * 2
      })
    });
    const orderData = await orderRes.json();
    assert(orderRes.status === 201, 'Nadia placed an order successfully');
    assert(orderData.order.total_amount === kit.price * 2, 'Order total matches item calculation');

    const kitAfter = db.prepare('SELECT stock FROM play_kits WHERE id = ?').get(kit.id) as { stock: number };
    assert(kitAfter.stock === stockBefore - 2, 'Play kit inventory decreased by ordered quantity');

    // Verify Omar cannot see Nadia's new order
    const omarOrdersRes = await fetch(`${baseUrl}/api/orders`, {
      headers: { Authorization: `Bearer ${omarToken}` }
    });
    const omarOrders = await omarOrdersRes.json();
    const nadiaOrderPresent = omarOrders.orders.some((o: any) => o.id === orderData.order.id);
    assert(!nadiaOrderPresent, 'Omar CANNOT see Nadia order in his order list');

    // Admin updates order shipping status
    const updateStatusRes = await fetch(`${baseUrl}/api/orders/${orderData.order.id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ shipping_status: 'Shipped' })
    });
    const updatedOrder = await updateStatusRes.json();
    assert(updateStatusRes.status === 200, 'Admin can update order status');
    assert(updatedOrder.order.shipping_status === 'Shipped', 'Order shipping status is now Shipped');

    console.log('\n========================================');
    console.log('🎉 ALL RBAC & API TESTS PASSED SUCCESSFULLY!');
    console.log('========================================\n');
    process.exit(0);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
