import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { integrationSettings } from '@/lib/db/schema';

export type IntegrationField =
  | 'serpapiKey' | 'ignavApiKey' | 'pexelsApiKey' | 'hapuppyApiKey'
  | 'cloudflareAccountId' | 'cloudflareImagesApiToken'
  | 'r2AccountId' | 'r2AccessKeyId' | 'r2SecretAccessKey' | 'r2BucketName' | 'r2PublicUrlBase';

function envFallback(): Record<IntegrationField, string | undefined> {
  return {
    serpapiKey: process.env.SERPAPI_KEY,
    ignavApiKey: process.env.IGNAV_API_KEY,
    pexelsApiKey: process.env.PEXELS_API_KEY,
    hapuppyApiKey: process.env.HAPUPPY_API_KEY,
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareImagesApiToken: process.env.CLOUDFLARE_IMAGES_API_TOKEN,
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2BucketName: process.env.R2_BUCKET_NAME,
    r2PublicUrlBase: process.env.R2_PUBLIC_URL_BASE,
  };
}

// DB value wins when set; otherwise falls back to the env var default, so teams
// that haven't touched Settings keep working off the Dokploy-managed keys.
export async function getIntegrationKey(teamId: number | null, field: IntegrationField): Promise<string | undefined> {
  if (teamId) {
    const [row] = await db.select().from(integrationSettings).where(eq(integrationSettings.teamId, teamId)).limit(1);
    const dbValue = row?.[field];
    if (dbValue) return dbValue;
  }
  return envFallback()[field];
}

// Resolves every field at once — used by the settings page GET to show effective values.
export async function getAllIntegrationKeys(teamId: number | null): Promise<Record<IntegrationField, string | undefined>> {
  const fallback = envFallback();
  if (!teamId) return fallback;

  const [row] = await db.select().from(integrationSettings).where(eq(integrationSettings.teamId, teamId)).limit(1);
  if (!row) return fallback;

  const result = {} as Record<IntegrationField, string | undefined>;
  for (const field of Object.keys(fallback) as IntegrationField[]) {
    result[field] = row[field] || fallback[field];
  }
  return result;
}
