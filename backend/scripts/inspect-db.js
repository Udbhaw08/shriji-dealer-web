import { sql } from '../src/db/pool.js';

async function main() {
  try {
    const vaultTables = await sql`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'vault';
    `;
    console.log('Vault tables:', vaultTables.map((t) => t.table_name));

    if (vaultTables.some((t) => t.table_name === 'secrets')) {
      const secrets = await sql`SELECT id, name, description FROM vault.secrets;`;
      console.log('Vault secrets:', secrets);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
