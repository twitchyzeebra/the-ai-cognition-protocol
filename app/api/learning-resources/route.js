import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const postsDirectory = path.join(process.cwd(), 'learning-resources');
        const filenames = fs.readdirSync(postsDirectory).filter((f) => f.toLowerCase().endsWith('.md'));

        const resources = filenames.map((filename) => {
            const slug = filename.replace(/\.md$/, '');
            return {
                slug,
                title: slug.replace(/-/g, ' '), // Simple title generation
            };
        });

        return NextResponse.json(resources);
    } catch (error) {
        console.error('Failed to list learning resources:', error);
        return NextResponse.json({ message: 'Failed to list learning resources' }, { status: 500 });
    }
}
