const router = require('../routes/users');
console.log('Registered GET routes in users.js:');
router.stack.forEach(layer => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
    console.log(`- [${methods}] ${layer.route.path}`);
  }
});
