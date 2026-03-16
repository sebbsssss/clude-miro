import './globals.css'

export const metadata = {
  title: 'CludeMiro — Memory-Enhanced Swarm Simulation',
  description: 'What happens when 500K AI agents get real memory? Clude × MiroFish benchmark.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
