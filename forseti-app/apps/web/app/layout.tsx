import type { Metadata } from "next"
import { Roboto } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import ElectronTitleBar from "./components/ElectronTitleBar"
import LoadingScreen from "./components/LoadingScreen"
import NavigationHandler from "./components/NavigationHandler"

const roboto = Roboto({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
})

export const metadata: Metadata = {
  title: "Forseti - Esports Performance Tracking",
  description: "Track, analyze, and improve your esports performance",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={roboto.variable}>
      <body className="bg-forseti-bg-primary text-forseti-text-primary antialiased font-sans">
        <LoadingScreen duration={2000} />
        <ElectronTitleBar />
        <NavigationHandler />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
