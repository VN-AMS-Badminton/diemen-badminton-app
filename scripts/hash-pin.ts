// One-off helper: bcrypt-hash a PIN to paste into seed_admin migration.
// Usage: npm run hash-pin -- 123456

import bcrypt from "bcryptjs";

const pin = process.argv[2];

if (!pin || !/^\d{4,6}$/.test(pin)) {
  console.error("Usage: npm run hash-pin -- <4-or-6-digit-PIN>");
  process.exit(1);
}

const hash = bcrypt.hashSync(pin, 10);
console.log(hash);
