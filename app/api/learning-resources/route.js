import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import matter from 'gray-matter';

export async function GET() {
    try {
        const postsDirectory = path.join(process.cwd(), 'learning-resources');
        
        const polishedDir = path.join(postsDirectory, 'polished');
        const rawDir = path.join(postsDirectory, 'raw');
        
        const resources = [];
        
        // Read polished documents
        if (fs.existsSync(polishedDir)) {
            const polishedFiles = fs.readdirSync(polishedDir).filter(f => f.toLowerCase().endsWith('.md'));
            polishedFiles.forEach(filename => {
                const slug = filename.replace(/\.md$/, '');
                const filePath = path.join(polishedDir, filename);
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const { data } = matter(fileContent);
                resources.push({
                    slug: `polished/${slug}`,
                    title: slug,
                    category: 'polished',
                    complexity: data.complexity 
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
                const { data } = matter(fileContent);
                resources.push({
                    slug: `raw/${slug}`,
                    title: slug,
                    category: 'raw',
                    complexity: data.complexity 
                });
            });
        }

        return NextResponse.json(resources);
    } catch (error) {
        console.error('Failed to list learning resources:', error);
        return NextResponse.json({ message: 'Failed to list learning resources' }, { status: 500 });
    }
}
