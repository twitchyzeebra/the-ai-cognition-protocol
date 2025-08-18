import './globals.css';
import './components/Sidebar.css';
export const metadata = {
  title: 'The AI Cognition Protocol',
  description: 'An AI-driven platform for exploring the architecture of cognition.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>
  {children}
      </body>
    </html>
  )
}
