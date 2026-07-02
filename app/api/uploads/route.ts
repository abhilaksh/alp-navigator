import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getIntegrationKey } from '@/lib/settings/integration-keys';

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_PDF_TYPE = 'application/pdf';

interface UploadKeys {
  cloudflareAccountId?: string;
  cloudflareImagesApiToken?: string;
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2BucketName?: string;
  r2PublicUrlBase?: string;
}

async function resolveUploadKeys(teamId: number | null): Promise<UploadKeys> {
  const [
    cloudflareAccountId, cloudflareImagesApiToken,
    r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName, r2PublicUrlBase,
  ] = await Promise.all([
    getIntegrationKey(teamId, 'cloudflareAccountId'),
    getIntegrationKey(teamId, 'cloudflareImagesApiToken'),
    getIntegrationKey(teamId, 'r2AccountId'),
    getIntegrationKey(teamId, 'r2AccessKeyId'),
    getIntegrationKey(teamId, 'r2SecretAccessKey'),
    getIntegrationKey(teamId, 'r2BucketName'),
    getIntegrationKey(teamId, 'r2PublicUrlBase'),
  ]);
  return { cloudflareAccountId, cloudflareImagesApiToken, r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName, r2PublicUrlBase };
}

function r2Client(keys: UploadKeys): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${keys.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: keys.r2AccessKeyId!,
      secretAccessKey: keys.r2SecretAccessKey!,
    },
  });
}

async function uploadImage(file: File, keys: UploadKeys): Promise<string> {
  const cfForm = new FormData();
  cfForm.set('file', file, file.name);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${keys.cloudflareAccountId}/images/v1`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${keys.cloudflareImagesApiToken}` },
      body: cfForm,
    }
  );

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(`Cloudflare Images upload failed: ${JSON.stringify(data.errors ?? data)}`);
  }

  const variants: string[] = data.result?.variants ?? [];
  const url = variants[0];
  if (!url) throw new Error('Cloudflare Images upload returned no variant URL');
  return url;
}

async function uploadPdf(file: File, keys: UploadKeys): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `pdfs/${randomBytes(8).toString('hex')}-${safeName}`;

  await r2Client(keys).send(new PutObjectCommand({
    Bucket: keys.r2BucketName!,
    Key: key,
    Body: bytes,
    ContentType: ALLOWED_PDF_TYPE,
  }));

  const base = keys.r2PublicUrlBase!.replace(/\/$/, '');
  return `${base}/${key}`;
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 15MB limit' }, { status: 400 });
  }

  const teamId = (await getUserWithTeam(user.id))?.teamId ?? null;
  const keys = await resolveUploadKeys(teamId);

  try {
    if (ALLOWED_IMAGE_TYPES.has(file.type)) {
      const url = await uploadImage(file, keys);
      return NextResponse.json({ url, fileName: file.name, mimeType: file.type });
    }
    if (file.type === ALLOWED_PDF_TYPE) {
      const url = await uploadPdf(file, keys);
      return NextResponse.json({ url, fileName: file.name, mimeType: file.type });
    }
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
