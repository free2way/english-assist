import 'dotenv/config';
import { importAllTextbookSamples, initializeDatabase } from '../server/db';

const main = async () => {
  await initializeDatabase();
  const textbooks = await importAllTextbookSamples();
  console.log(`Imported ${textbooks.length} textbook sample(s):`);
  textbooks.forEach((item) => {
    console.log(`- ${item.title}`);
  });
};

main().catch((error) => {
  console.error('Failed to import textbook samples');
  console.error(error);
  process.exit(1);
});
