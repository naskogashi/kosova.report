import '../../src/components/Footer'; // Varmistaa, että globaalit tyylit ladataan
import Footer from '../components/Footer';

export const metadata = {
  title: 'kosova.report',
  description: 'Civic tech platform for institutional accountability',
}

export default function RootLayout({ children }) {
  return (
    <html lang="sq">
      <body className="bg-gray-900 text-white min-h-screen flex flex-col">
        <main className="flex-grow flex flex-col">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}