import { AppDataSource } from './data-source';

async function runMigrations() {
  try {
    await AppDataSource.initialize();
    // eslint-disable-next-line no-console
    console.log('Running migrations...');
    await AppDataSource.runMigrations();
    // eslint-disable-next-line no-console
    console.log('Migrations complete.');
    await AppDataSource.destroy();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
