#!/bin/bash
set -e
echo "=== Switching Prisma to MySQL ==="
sed -i.bak 's/provider = "sqlite"/provider = "mysql"/' prisma/schema.prisma
echo "✓ Switched to MySQL. Backup at prisma/schema.prisma.bak"
echo ""
echo "Next steps:"
echo "1. Update DATABASE_URL in .env to: mysql://user_bdtech:PASSWORD@127.0.0.1:3306/db_bdtech"
echo "2. Run: npx prisma db push --accept-data-loss"
echo "3. Run: npx tsx prisma/seed.ts"
echo "4. Run: npx tsx scripts/generate_ai_workforce.ts"
echo "5. Run: npx tsx scripts/generate_phase7.ts"
echo "6. Run: npx tsx scripts/seed_content.ts"
