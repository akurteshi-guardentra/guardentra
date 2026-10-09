import { readFile } from 'node:fs/promises';
import { Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector';
import pg from 'pg';
import { managedConfig, prepareMigrations, runMigrations } from './core.mjs';

let connector;
let client;
try {
  const config = managedConfig(process.env);
  const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
  const migrations = await prepareMigrations(new URL('./migrations/', import.meta.url).pathname, manifest);
  connector = new Connector();
  const options = await connector.getOptions({
    instanceConnectionName: config.instance, ipType: IpAddressTypes.PRIVATE,
  });
  client = new pg.Client({ ...options, database: config.database,
    user: config.user, password: config.password, connectionTimeoutMillis: 30000 });
  await client.connect();
  const result = await runMigrations(client, migrations);
  console.log(JSON.stringify({ status: 'PASS', transport: 'private-cloud-sql-connector', ...result }));
} catch {
  // Raw pg/connector errors can contain authentication or connection data.
  console.error('Managed audit migration failed; review prerequisites and safe job metadata.');
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => { process.exitCode = 1; });
  if (connector) await Promise.resolve().then(() => connector.close()).catch(() => { process.exitCode = 1; });
}
