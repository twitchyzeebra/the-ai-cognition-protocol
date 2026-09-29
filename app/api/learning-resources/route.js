import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import matter from 'gray-matter';

const ROOT = path.join(process.cwd(), 'learning-resources');
const CATEGORIES = { Polished: 'polished', Raw: 'raw', Human: 'human' };

const readingTime = (content) => {
    const words = content.replace(/```[\s\S]*?```|`[^`]+`|[#*_>\[\]()!-]/g, '').trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
};

export async function GET() {
    try {
        const resources = Object.entries(CATEGORIES).flatMap(([dir, category]) => {
            const dirPath = path.join(ROOT, dir);
            if (!fs.existsSync(dirPath)) return [];
            return fs.readdirSync(dirPath).filter(f => f.toLowerCase().endsWith('.md')).map(filename => {
                const title = filename.replace(/\.md$/, '');
                const { data, content } = matter(fs.readFileSync(path.join(dirPath, filename), 'utf-8'));
                return {
                    slug: `${dir}/${title}`,
                    title,
                    category,
                    complexity: data.complexity,
                    // Exported chats (starting with a '## User' turn) can be continued in the chat.
                    chattable: data.chattable !== undefined ? data.chattable : content.trim().startsWith('## User'),
                    readingTime: readingTime(content)
                };
            });
        });
        return NextResponse.json(resources);
    } catch (error) {
        console.error('Failed to list learning resources:', error);
        return NextResponse.json({ message: 'Failed to list learning resources' }, { status: 500 });
    }
}
