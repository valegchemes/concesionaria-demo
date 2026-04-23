const fetch = require('node-fetch');

async function test() {
  // Let's first get the unit
  const unitId = 'cmoathlre000313x2e6i5q21r';
  const getRes = await fetch(`http://localhost:3000/api/units/${unitId}`);
  const getData = await getRes.json();
  const unit = getData.data;

  // Now let's try to patch it
  const payload = {
    ...unit,
    acquisitionCostArs: 1123,
    acquisitionCostUsd: 0,
  };

  // The request requires authentication, so wait, I can't easily fetch authenticated unless I pass cookies...
  // BUT I can just write a script that imports the validation schema and parses it directly!
}
test();
