import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Benchmark Express",
  description: "Boarding school money management for parents and bursars",
  applicationName: "Benchmark Express",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Benchmark Express",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

const themeBootScript = `(function(){try{var t=localStorage.getItem("schoolpurse-theme");var sysDark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;var dark;if(t==="light"){dark=false;}else if(t==="dark"){dark=true;}else if(t==="system"){dark=!!sysDark;}else{dark=true;}var r=document.documentElement;if(dark){r.classList.add("dark");r.classList.remove("light");}else{r.classList.remove("dark");r.classList.add("light");}}catch(e){document.documentElement.classList.add("dark");}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Lora:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
