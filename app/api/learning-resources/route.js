import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import matter from 'gray-matter';

function calculateReadingTime(content) {
    const plainText = content.replace(/```[\s\S]*?```|`[^`]+`|[#*_>\[\]()!-]/g, '');
    const wordCount = plainText.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / 200));
}

function isChattable(content) {
    return content.trim().startsWith('## User');
}

export async function GET() {
    try {
        const postsDirectory = path.join(process.cwd(), 'learning-resources');
        
        const categories = [
            { dir: 'Polished', category: 'polished' },
            { dir: 'Raw', category: 'raw' },
            { dir: 'Human', category: 'human' },
        ];

        const resources = [];

        for (const { dir, category } of categories) {
            const fullPath = path.join(postsDirectory, dir);
            if (!fs.existsSync(fullPath)) continue;

            const files = fs.readdirSync(fullPath).filter(f => f.toLowerCase().endsWith('.md'));
            files.forEach(filename => {
                const slug = filename.replace(/\.md$/, '');
                const filePath = path.join(fullPath, filename);
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const { data, content } = matter(fileContent);
                resources.push({
                    slug: `${dir}/${slug}`,
                    title: slug,
                    category,
                    complexity: data.complexity,
                    chattable: data.chattable !== undefined ? data.chattable : isChattable(content),
                    readingTime: calculateReadingTime(content)
                });
            });
        }

        return NextResponse.json(resources);
    } catch (error) {
        console.error('Failed to list learning resources:', error);
        return NextResponse.json({ message: 'Failed to list learning resources' }, { status: 500 });
    }
}
