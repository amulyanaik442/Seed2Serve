'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT, 10) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'seed2serve';

  console.log(`Connecting to MySQL server at ${host}:${port} as "${user}"...`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });
    console.log('✓ Successfully connected to MySQL server.');

    console.log(`Creating database "${database}" if it does not exist...`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✓ Database "${database}" verified.`);

    await connection.changeUser({ database });

    const sqlFile = path.join(__dirname, 'seed2serve.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('Executing schema import from seed2serve.sql...');
    await connection.query(sqlContent);
    console.log('✓ Tables (users, password_resets) initialized successfully.');

    await connection.end();
    console.log('\n🎉 Database setup completed successfully!');
  } catch (err) {
    console.error('\n❌ Database setup error:', err.code || err.message || err);
    if (connection) await connection.end().catch(() => {});
    process.exit(1);
  }
}

main();
