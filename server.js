const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());
app.use(cors());

// ==========================================
// 3. TABLE STATE MACHINE & SESSION MANAGEMENT
// ==========================================
const tables = {
  "T-01": { id: "T-01", status: "Unoccupied", session: null }, // Unoccupied, Reserved, Occupied
  "T-02": { id: "T-02", status: "Unoccupied", session: null },
  "T-08": { id: "T-08", status: "Occupied", session: "session_A04" }
};

// ==========================================
// 1. OPTIMIZED FIFO QUEUE ALGORITHM
// ==========================================
let queueList = [
  { queueNo: "A-01", name: "คุณสมชาย", status: "Waiting", offset: 0 },
  { queueNo: "A-02", name: "คุณวิไล", status: "Waiting", offset: 0 },
  { queueNo: "A-03", name: "คุณ 1-2 คน", status: "Waiting", offset: 0 },
  { queueNo: "A-04", name: "บุษราคัม", status: "Waiting", offset: 0, tableId: "T-08" }
];

// ฟังก์ชันข้ามคิวชั่วคราว (+2 ตำแหน่งถ้าคิวแรกยังไม่มา)
function shiftQueue(queueNo) {
  const index = queueList.findIndex(q => q.queueNo === queueNo);
  if (index !== -1 && index + 2 < queueList.length) {
    const item = queueList.splice(index, 1)[0];
    item.offset += 2;
    queueList.splice(index + 2, 0, item);
    return true;
  }
  return false;
}

// ==========================================
// 1 & 6. BUSINESS LOGIC & API GATEWAY (ORDERS)
// ==========================================
app.post('/api/orders', (req, res) => {
  const { tableId, items } = req.body;

  // Data Validation (API Gateway Check)
  if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "ข้อมูลออเดอร์ไม่ถูกต้องหรือไม่มีรายการอาหาร" });
  }

  // คำนวณยอดเงินและภาษี (Business Logic Calculations)
  let subtotal = 0;
  items.forEach(item => {
    subtotal += item.price * item.qty;
  });

  const serviceCharge = subtotal * 0.10; // 10%
  const vat = (subtotal + serviceCharge) * 0.07; // 7% VAT
  const netTotal = subtotal + serviceCharge + vat;

  const orderData = {
    orderId: "ORD-" + Date.now(),
    tableId,
    items,
    calculation: {
      subtotal,
      serviceCharge: parseFloat(serviceCharge.toFixed(2)),
      vat: parseFloat(vat.toFixed(2)),
      netTotal: parseFloat(netTotal.toFixed(2))
    },
    status: "Pending Kitchen",
    timestamp: new Date()
  };

  // 2. REAL-TIME COMMUNICATION (ส่งเข้าครัวผ่าน WebSocket)
  io.to('kitchen-room').emit('new-kitchen-order', orderData);

  // อัปเดตสถานะโต๊ะเป็น Occupied (Table State Machine)
  if (tables[tableId]) {
    tables[tableId].status = "Occupied";
  }

  res.status(201).json({
    success: true,
    message: "บันทึกและส่งออเดอร์เข้าห้องครัวเรียบร้อย",
    data: orderData
  });
});

// ==========================================
// 4. DYNAMIC QR CODE & POS INTEGRATION
// ==========================================
app.post('/api/payment/generate-qr', (req, res) => {
  const { tableId, netTotal } = req.body;
  
  if (!tableId || !netTotal) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วนสำหรับการสร้าง QR Code" });
  }

  // จำลองการสร้าง Dynamic QR Payload สำหรับ PromptPay ล็อกยอดเงินและโต๊ะ
  const qrPayload = `PROMPTPAY_LUMEN_DINING_${tableId}_AMOUNT_${netTotal}`;

  res.json({
    success: true,
    tableId,
    netTotal,
    qrPayload,
    message: "สร้าง Dynamic QR Code สำหรับชำระเงินสำเร็จ"
  });
});

// ==========================================
// 2 & 5. WEBSOCKETS & AUTOMATED NOTIFICATIONS
// ==========================================
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // เข้าร่วมห้องตามบทบาท (Role Management)
  socket.on('join-role', (role) => {
    if (role === 'kitchen') socket.join('kitchen-room');
    if (role === 'customer') socket.join('customer-room');
    if (role === 'staff') socket.join('staff-room');
    console.log(`Socket ${socket.id} joined role: ${role}`);
  });

  // 5. ระบบส่งข้อความแจ้งเตือนอัตโนมัติ (จำลองการเรียกคิว)
  socket.on('notify-queue', (data) => {
    const { queueNo, phone } = data;
    // จำลองการยิง SMS API
    console.log(`[SMS Notification] ส่งไปยังเบอร์ ${phone}: คิว ${queueNo} ของท่านใกล้ถึงเวลาบริการแล้ว กรุณามาที่หน้าร้าน`);
    io.to('customer-room').emit('queue-alert', { queueNo, message: "โต๊ะของคุณใกล้พร้อมแล้ว" });
  });

  // ลูกค้ากดเรียกพนักงาน
  socket.on('call-staff', (data) => {
    const { tableId, requestType } = data;
    io.to('staff-room').emit('staff-alert', { tableId, requestType, time: new Date() });
    console.log(`[Staff Alert] โต๊ะ ${tableId} เรียกพนักงาน: ${requestType}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// เปิดเซิร์ฟเวอร์ที่พอร์ต 3000
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`LUMEN Dining Backend running on port ${PORT}`);
});