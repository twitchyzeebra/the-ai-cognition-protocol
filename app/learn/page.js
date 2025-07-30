import fs from 'fs';
import path from 'path';
import Link from 'next/link';

function getPosts() {
    const postsDirectory = path.join(process.cwd(), 'learning-resources');
    const filenames = fs.readdirSync(postsDirectory);

    return filenames.map((filename) => {
        const slug = filename.replace(/\.md$/, '');
        return {
            slug,
            title: slug.replace(/-/g, ' '), // Simple title generation
        };
    });
}

export default function LearnIndex() {
    const posts = getPosts();

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Learning Resources</h1>
            <ul>
                {posts.map((post) => (
                    <li key={post.slug} className="mb-2">
                        <Link href={`/learn/${post.slug}`} className="text-blue-500 hover:underline capitalize">
                            {post.title}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
