const fs = require('fs');

async function check() {
  console.log("Loading module...");
  try {
    const mod = require('./.next/server/app/api/billing/checkout/route.js');
    console.log("Module loaded successfully.");
  } catch (err) {
    console.error("Module load failed message:", err.message);
    console.error("Module load failed stack:", err.stack);
    console.error("Module load failed keys:", Object.keys(err));
    return;
  }
}

check();
