import bcrypt from 'bcryptjs';

const hash = "$2a$10$ekV6ICMVg6dyhBqE/LiUEOXsLLX5wL5PfDnlvC3xN5YnnIWdxs8h2";

const passwords = ['tech01', 'tech123', 'tech', 'password', 'admin', 'admin123', '123456', 'password123'];
for (const pwd of passwords) {
  const match = bcrypt.compareSync(pwd, hash);
  console.log(`Password '${pwd}': ${match ? '✅ MATCH' : '❌ no match'}`);
}

// Also generate a hash for 'tech01' to verify bcrypt works
const newHash = bcrypt.hashSync('tech01', 10);
console.log(`\nNew hash for 'tech01': ${newHash}`);
console.log(`Verify new hash: ${bcrypt.compareSync('tech01', newHash)}`);