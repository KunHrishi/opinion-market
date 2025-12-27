"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (user && !isAdmin) {
      router.push("/");
    }
  }, [user, isAdmin, router]);

  if (!user || !isAdmin) return null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>

      <div className="grid gap-4">
        <Link
          href="/create-market"
          className="block border rounded p-4 hover:bg-gray-50 transition"
        >
          <h2 className="font-semibold">Create Market</h2>
          <p className="text-sm text-gray-600">
            Create a new prediction market
          </p>
        </Link>

        <Link
          href="/admin/markets"
          className="block border rounded p-4 hover:bg-gray-50 transition"
        >
          <h2 className="font-semibold">View Markets</h2>
          <p className="text-sm text-gray-600">
            Browse and manage existing markets
          </p>
        </Link>
      </div>
    </div>
  );
}
