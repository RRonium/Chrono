export const metadata = {
  title: 'Chrono',
  description: 'Global market intelligence'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
