import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    const error = await requireAdmin();
    if (error) {
        return NextResponse.json({ error }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG, and WebP are allowed.' }, { status: 400 });
        }

        const authDir = process.env.WA_AUTH_DIR || path.join(process.cwd(), 'wa-auth');
        const uploadsDir = path.join(authDir, 'uploads');
        
        // Ensure the directory exists
        await fs.mkdir(uploadsDir, { recursive: true });

        // Save the file as faq-map.jpg
        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = path.join(uploadsDir, 'faq-map.jpg');
        
        await fs.writeFile(filePath, buffer);

        return NextResponse.json({ success: true, path: filePath });
    } catch (err) {
        console.error('[upload-map] Failed to upload map image:', err);
        return NextResponse.json({ error: 'Failed to upload map image' }, { status: 500 });
    }
}
