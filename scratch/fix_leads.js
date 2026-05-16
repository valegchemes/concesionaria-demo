const fs = require('fs');
const file = 'lib/domains/leads/service.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/activities: true,/g, 'activities: { include: { createdBy: { select: { name: true } } } },');

fs.writeFileSync(file, content);
console.log('Replaced activities: true in service.ts');
