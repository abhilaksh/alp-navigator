import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';
import { getUser } from '@/lib/db/queries';

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_PDF_TYPE = 'application/pdf';

function r2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

async function uploadImage(file: File): Promise<string> {
  const cfForm = new FormData();
  cfForm.set('file', file, file.name);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v1`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_IMAGES_API_TOKEN}` },
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

async function uploadPdf(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `pdfs/${randomBytes(8).toString('hex')}-${safeName}`;

  await r2Client().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: bytes,
    ContentType: ALLOWED_PDF_TYPE,
  }));

  const base = process.env.R2_PUBLIC_URL_BASE!.replace(/\/$/, '');
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

  try {
    if (ALLOWED_IMAGE_TYPES.has(file.type)) {
      const url = await uploadImage(file);
      return NextResponse.json({ url, fileName: file.name, mimeType: file.type });
    }
    if (file.type === ALLOWED_PDF_TYPE) {
      const url = await uploadPdf(file);
      return NextResponse.json({ url, fileName: file.name, mimeType: file.type });
    }
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
