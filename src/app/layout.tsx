import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import Header from "../components/Header";

export const metadata = {
  title: "Prediction Market",
  description: "Credit-based prediction market platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <AuthProvider>
          <Header />
          {children}

        </AuthProvider>
      </body>
    </html>
  );
}
