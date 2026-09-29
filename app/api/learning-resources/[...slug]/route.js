import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import matter from 'gray-matter';

const ROOT = path.join(process.cwd(), 'learning-resources');

export async function GET(request, { params }) {
    try {
        const { slug } = await params;
        const filePath = path.resolve(ROOT, `${slug.join('/')}.md`);
        // Only files inside learning-resources/ (rejects "../" traversal).
        if (!filePath.startsWith(ROOT + path.sep) || !fs.existsSync(filePath)) {
            return NextResponse.json({ message: 'Resource not found' }, { status: 404 });
        }
        return NextResponse.json({ content: matter(fs.readFileSync(filePath, 'utf-8')).content });
    } catch (error) {
        console.error('Failed to read resource:', error);
        return NextResponse.json({ message: 'Failed to read resource' }, { status: 500 });
    }
}
