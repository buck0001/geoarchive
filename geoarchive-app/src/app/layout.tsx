import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoArchive — Places to keep",
  description: "A little archive for all the places that made you stop and look.",
};

const themeInitScript = `try{var t=localStorage.getItem("geoarchive.theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
