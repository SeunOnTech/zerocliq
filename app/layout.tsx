import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppKitProvider } from "@/providers/AppKitProvider";
import { AuthSync } from "@/components/AuthSync";
import { ChainSync } from "@/components/ChainSync";
import { BalanceSync } from "@/components/BalanceSync";
import { PriceSync } from "@/components/PriceSync";
import { TradeCardSync } from "@/components/TradeCardSync";
import { ToastContainer } from "@/components/ui/toast";
import localFont from "next/font/local"

const inter = Inter({ subsets: ["latin"] });

const satoshi = localFont({
  src: [
    {
      path: "../public/fonts/Satoshi-Light.woff2",
      weight: "300",
    },
    {
      path: "../public/fonts/Satoshi-Regular.woff2",
      weight: "400",
    },
    {
      path: "../public/fonts/Satoshi-Medium.woff2",
      weight: "500",
    },
    {
      path: "../public/fonts/Satoshi-Bold.woff2",
      weight: "700",
    },
    {
      path: "../public/fonts/Satoshi-Black.woff2",
      weight: "900",
    },
  ],
  variable: "--font-satoshi",
})


export const metadata: Metadata = {
  title: "ZeroCliq - Zero Clicks. Infinite Yield.",
  description: "Trade DeFi without signature fatigue. Experience gasless transactions powered by account abstraction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning style={{ fontFamily: satoshi.style.fontFamily }}>
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppKitProvider>
            <AuthSync />
            <ChainSync />
            <BalanceSync />
            <PriceSync />
            <TradeCardSync />
            {children}
            <ToastContainer />
          </AppKitProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

