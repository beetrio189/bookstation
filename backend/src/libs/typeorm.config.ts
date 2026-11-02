import { join } from 'path';
import { DataSource } from 'typeorm';
import { env } from '../config';

const dataSource = new DataSource({
  type: 'postgres',
  url: env.databaseUrl,
  entities: [join(__dirname, '..', 'modules', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
  synchronize: false,
});

export default dataSource;
