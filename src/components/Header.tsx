"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

export default function Header() {
  const { user, credits, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-white border-b p-4 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0">
      {/* Logo */}
      <Link href="/" className="font-bold text-lg">
        Prediction Market
      </Link>

      {/* Navigation */}
      <nav className="flex gap-4 items-center mt-2 sm:mt-0">
        {user ? (
          <>
            <Link href="/profile" className="hover:underline">
              Profile
            </Link>

            <span className="text-sm text-gray-600">
              Credits: {credits}
            </span>

            {/* Admin-only links */}
            {isAdmin && (
              <>
                <Link href="/admin" className="hover:underline">
                  Admin Panel
                </Link>
              </>
            )}
          </>
        ) : (
          <>
            <Link href="/login" className="hover:underline">
              Login
            </Link>
            <Link href="/signup" className="hover:underline">
              Signup
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
