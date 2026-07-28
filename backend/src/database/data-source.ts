import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });

export default new DataSource({
  // type: 'mysql',
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  extra: {
    multipleStatements: true, // 👈 cho phép multi-query
  },
});
