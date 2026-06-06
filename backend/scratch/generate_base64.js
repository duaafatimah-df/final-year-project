const svg_lightweight = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="#0f172a"/><rect x="10" y="10" width="280" height="280" rx="15" fill="none" stroke="#10b981" stroke-width="4" stroke-dasharray="10 5"/><path d="M150 90 C130 60, 90 60, 90 100 C90 140, 150 200, 150 210 C150 200, 210 140, 210 100 C210 60, 170 60, 150 90 Z" fill="#10b981" opacity="0.8"/><text x="50%" y="80%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="bold" fill="#f1f5f9">SpareShare AI</text><text x="50%" y="87%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#94a3b8">Verified Donation Item</text></svg>`;
const svg_user_pic = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#10b981"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40" font-weight="bold" fill="white">U</text></svg>`;
const svg_user_banner = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200" viewBox="0 0 800 200"><rect width="800" height="200" fill="#1e293b"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="bold" fill="#10b981">SpareShare Partner</text></svg>`;

console.log("LIGHTWEIGHT_PLACEHOLDER:");
console.log("data:image/svg+xml;base64," + Buffer.from(svg_lightweight).toString('base64'));
console.log("\nUSER_PIC_PLACEHOLDER:");
console.log("data:image/svg+xml;base64," + Buffer.from(svg_user_pic).toString('base64'));
console.log("\nUSER_BANNER_PLACEHOLDER:");
console.log("data:image/svg+xml;base64," + Buffer.from(svg_user_banner).toString('base64'));
