// LUMEN Dining - Page 1 UI Interactions (Step 1)

document.addEventListener('DOMContentLoaded', () => {
  console.log('LUMEN Dining Page 1 (Welcome UI) Loaded!');

  const btnHome = document.getElementById('btnHome');
  const btnMenu = document.getElementById('btnMenu');
  const btnBooking = document.getElementById('btnBooking');

  // ใส่ EventListener เตรียมไว้สำหรับ Step 2 (การกดปุ่มลิงก์หน้า)
  btnHome.addEventListener('click', () => {
    console.log('กดปุ่ม: เข้าหน้าหลัก');
  });

  btnMenu.addEventListener('click', () => {
    console.log('กดปุ่ม: ดูเมนูอาหาร');
  });

  btnBooking.addEventListener('click', () => {
    console.log('กดปุ่ม: จองโต๊ะออนไลน์');
  });
});