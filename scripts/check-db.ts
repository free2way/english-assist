import 'dotenv/config';
import { initializeDatabase, listTextbookSamples, listTextbooks } from '../server/db';

const main = async () => {
  await initializeDatabase();
  const textbooks = await listTextbooks();
  const samples = await listTextbookSamples();

  console.log('Database ready');
  console.log('Driver:', process.env.TURSO_DATABASE_URL ? 'turso-remote' : 'libsql-file');
  console.log('Textbooks:', textbooks.length);
  console.log('Samples:', samples.length);
};

main().catch((error) => {
  console.error('Database check failed');
  console.error(error);
  process.exit(1);
});
