import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import matter from 'gray-matter';

export async function GET(request, { params }) {
    try {
        // Join the slug array back into a path
        const slugParts = Array.isArray(params?.slug) ? params.slug : [];
        const slug = slugParts.join('/');
        const postsDirectory = path.join(process.cwd(), 'learning-resources');
        const filePath = path.join(postsDirectory, `${slug}.md`);
        const normalizedPath = path.normalize(filePath);

        const relativePath = path.relative(postsDirectory, normalizedPath);
        if (!slug || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            return NextResponse.json({ message: 'Resource not found' }, { status: 404 });
        }

        if (!fs.existsSync(normalizedPath)) {
            return NextResponse.json({ message: 'Resource not found' }, { status: 404 });
        }

        const fileContent = fs.readFileSync(normalizedPath, 'utf-8');
        const { content } = matter(fileContent); 

        return NextResponse.json({ content });
    } catch (error) {
        console.error('Failed to read resource:', error);
        return NextResponse.json({ message: 'Failed to read resource' }, { status: 500 });
    }
}
