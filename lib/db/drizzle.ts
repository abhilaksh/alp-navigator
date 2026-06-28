import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const poolConnection = mysql.createPool(process.env.DATABASE_URL);
export const db = drizzle(poolConnection, { schema, mode: 'default' });
