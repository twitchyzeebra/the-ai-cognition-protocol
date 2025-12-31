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
        
        const polishedDir = path.join(postsDirectory, 'Polished');
        const rawDir = path.join(postsDirectory, 'Raw');
        
        const resources = [];
        
        // Read polished documents
        if (fs.existsSync(polishedDir)) {
            const polishedFiles = fs.readdirSync(polishedDir).filter(f => f.toLowerCase().endsWith('.md'));
            polishedFiles.forEach(filename => {
                const slug = filename.replace(/\.md$/, '');
                const filePath = path.join(polishedDir, filename);
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const { data, content } = matter(fileContent);
                resources.push({
                    slug: `Polished/${slug}`,
                    title: slug,
                    category: 'polished',
                    complexity: data.complexity,
                    chattable: data.chattable !== undefined ? data.chattable : isChattable(content),
                    readingTime: calculateReadingTime(content)
                });
            });
        }
        
        // Read raw documents
        if (fs.existsSync(rawDir)) {
            const rawFiles = fs.readdirSync(rawDir).filter(f => f.toLowerCase().endsWith('.md'));
            rawFiles.forEach(filename => {
                const slug = filename.replace(/\.md$/, '');
                const filePath = path.join(rawDir, filename);
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const { data, content } = matter(fileContent);
                resources.push({
                    slug: `Raw/${slug}`,
                    title: slug,
                    category: 'raw',
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
