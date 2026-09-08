import { z } from 'zod';
import { envSchema } from './env.schema';

export type AppConfig = z.infer<typeof envSchema>;
