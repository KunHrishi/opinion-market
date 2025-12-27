"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  Landmark,
  Trophy,
  Bitcoin,
  Film,
  Cpu,
} from "lucide-react";

/* ---------- Categories config ---------- */
const categories = [
  { label: "All", icon: Flame, href: "/" },
  { label: "Politics", icon: Landmark },
  { label: "Sports", icon: Trophy },
  { label: "Crypto", icon: Bitcoin },
  { label: "Entertainment", icon: Film },
  { label: "Technology", icon: Cpu },
];

export default function CategoryBar() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-30 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-3">
          {categories.map(({ label, icon: Icon, href }) => {
            const link =
              href || `/category/${encodeURIComponent(label)}`;

            const isActive =
              pathname === link ||
              pathname === `/category/${label}`;

            return (
              <Link
                key={label}
                href={link}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full whitespace-nowrap text-sm transition flex-shrink-0 ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
