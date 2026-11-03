#!/usr/bin/env node

/**
 * ==============================================================================
 * RUN ALL UNIT TESTS - MICROSERVICES TEST RUNNER
 * Hệ thống kiểm thử tự động toàn diện Jest + Supertest cho 5 Microservices
 * ==============================================================================
 */

const { execSync } = require('child_process');
const path = require('path');

const SERVICES = [
  { name: 'auth-service', label: 'Auth Service (Port 3005)' },
  { name: 'restaurant-service', label: 'Restaurant Service (Port 3001)' },
  { name: 'order-service', label: 'Order Service (Port 3002)' },
  { name: 'payment-service', label: 'Payment Service (Port 3003)' },
  { name: 'delivery-service', label: 'Delivery Service (Port 3004)' }
];

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

console.log(`\n${CYAN}${BOLD}==============================================================================${RESET}`);
console.log(`${CYAN}${BOLD}🚀 KHỞI ĐỘNG KIỂM THỬ TOÀN DIỆN 5 MICROSERVICES (JEST + SUPERTEST)${RESET}`);
console.log(`${CYAN}${BOLD}==============================================================================${RESET}\n`);

const startTimeTotal = Date.now();
const results = [];

for (let i = 0; i < SERVICES.length; i++) {
  const service = SERVICES[i];
  const serviceDir = path.resolve(__dirname, '..', 'services', service.name);

  process.stdout.write(`[${i + 1}/${SERVICES.length}] ⏳ Đang kiểm thử ${BOLD}${service.name}${RESET}... `);

  const startSingle = Date.now();
  try {
    const output = execSync('npm test', {
      cwd: serviceDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const duration = ((Date.now() - startSingle) / 1000).toFixed(2);

    // Trích xuất số lượng tests từ output của Jest
    let testsSummary = 'Tất cả Đạt';
    const match = output.match(/Tests:\s+([^\n]+)/);
    if (match) {
      testsSummary = match[1].trim();
    }

    results.push({
      service: service.name,
      label: service.label,
      status: 'PASS',
      duration: `${duration}s`,
      details: testsSummary
    });

    console.log(`${GREEN}${BOLD}✔ PASS${RESET} ${GRAY}(${duration}s)${RESET}`);
  } catch (error) {
    const duration = ((Date.now() - startSingle) / 1000).toFixed(2);
    const errorOutput = error.stdout || error.stderr || error.message;

    let testsSummary = 'Lỗi thực thi';
    const match = errorOutput.match(/Tests:\s+([^\n]+)/);
    if (match) {
      testsSummary = match[1].trim();
    }

    results.push({
      service: service.name,
      label: service.label,
      status: 'FAIL',
      duration: `${duration}s`,
      details: testsSummary,
      errorLog: errorOutput
    });

    console.log(`${RED}${BOLD}✖ FAIL${RESET} ${GRAY}(${duration}s)${RESET}`);
  }
}

const totalDuration = ((Date.now() - startTimeTotal) / 1000).toFixed(2);
const passedCount = results.filter((r) => r.status === 'PASS').length;
const failedCount = results.filter((r) => r.status === 'FAIL').length;

// In bảng kết quả tổng hợp
console.log(`\n${CYAN}${BOLD}==============================================================================${RESET}`);
console.log(`${CYAN}${BOLD}📊 BẢNG TỔNG HỢP KẾT QUẢ KIỂM THỬ UNIT TEST (TEST MATRIX)${RESET}`);
console.log(`${CYAN}${BOLD}==============================================================================${RESET}`);

console.log(
  `${BOLD}${'TÊN MICROSERVICE'.padEnd(25)} | ${'TRẠNG THÁI'.padEnd(12)} | ${'THỜI GIAN'.padEnd(10)} | ${'CHI TIẾT TESTS'}${RESET}`
);
console.log('-'.repeat(78));

for (const res of results) {
  const statusFormatted =
    res.status === 'PASS' ? `${GREEN}${BOLD}✔ PASS${RESET}      ` : `${RED}${BOLD}✖ FAIL${RESET}      `;
  const nameFormatted = res.service.padEnd(25);
  const durationFormatted = res.duration.padEnd(10);
  console.log(`${nameFormatted} | ${statusFormatted} | ${durationFormatted} | ${res.details}`);
}

console.log('-'.repeat(78));
console.log(
  `Tổng kết: ${passedCount === SERVICES.length ? GREEN : YELLOW}${BOLD}${passedCount}/${SERVICES.length} Services Pass${RESET} | ` +
    `Thất bại: ${failedCount > 0 ? RED : GREEN}${BOLD}${failedCount}${RESET} | ` +
    `Tổng thời gian chạy: ${CYAN}${BOLD}${totalDuration}s${RESET}\n`
);

if (failedCount > 0) {
  console.log(`${RED}${BOLD}🚨 CHI TIẾT CÁC LỖI THẤT BẠI:${RESET}`);
  results
    .filter((r) => r.status === 'FAIL')
    .forEach((r) => {
      console.log(`\n--- [${r.service}] ---\n${r.errorLog.substring(0, 1000)}`);
    });
  process.exit(1);
} else {
  console.log(`${GREEN}${BOLD}🎉 XUẤT SẮC! TOÀN BỘ 5 MICROSERVICES ĐỀU VƯỢT QUA TEST SUITE 100%!${RESET}\n`);
  process.exit(0);
}

