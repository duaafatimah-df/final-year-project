const fs = require('fs');
const path = require('path');

console.log("=========================================");
console.log("STARTING FRONTEND CODE INTEGRITY TESTS");
console.log("=========================================");

try {
  // Test 1: Check if index.html exists
  const hasIndex = fs.existsSync(path.join(__dirname, 'index.html'));
  console.log(`✓ index.html check: ${hasIndex ? 'PASS' : 'FAIL'}`);
  if (!hasIndex) throw new Error("index.html is missing");

  // Test 2: Check if package.json has dependencies
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const hasReact = !!packageJson.dependencies.react;
  console.log(`✓ React dependency check: ${hasReact ? 'PASS' : 'FAIL'}`);
  if (!hasReact) throw new Error("React dependency is missing");

  // Test 3: Check if main.jsx exists
  const hasMain = fs.existsSync(path.join(__dirname, 'src', 'main.jsx'));
  console.log(`✓ main.jsx check: ${hasMain ? 'PASS' : 'FAIL'}`);
  if (!hasMain) throw new Error("main.jsx is missing");

  // Test 4: Check if App.jsx exists
  const hasApp = fs.existsSync(path.join(__dirname, 'src', 'App.jsx'));
  console.log(`✓ App.jsx check: ${hasApp ? 'PASS' : 'FAIL'}`);
  if (!hasApp) throw new Error("App.jsx is missing");

  console.log("\n=========================================");
  console.log("ALL FRONTEND INTEGRITY CHECKS PASSED!");
  console.log("=========================================");
  process.exit(0);
} catch (err) {
  console.error("❌ Test failed:", err.message);
  process.exit(1);
}
