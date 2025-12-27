"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { v4 as uuid } from "uuid";
import { Timestamp } from "firebase/firestore";

type MarketType = "yesno" | "options";

export default function CreateMarketPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [type, setType] = useState<MarketType>("yesno");

  const [options, setOptions] = useState<string[]>(["", ""]);
  const [sources, setSources] = useState<string[]>([""]);

  /* 🔹 IMAGE STATE (unchanged) */
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  /* 🔹 NEW FIELDS */
  const [category, setCategory] = useState("Trending");
 
  const [closeTime, setCloseTime] = useState<string>("");

  const [loading, setLoading] = useState(false);

  /* ------------------ Redirect if not logged in ------------------ */
  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  if (!user) return null;

  /* ------------------ Option Handlers ------------------ */
  const handleAddOption = () => {
    setOptions([...options, ""]);
  };

  const handleOptionChange = (idx: number, value: string) => {
    const updated = [...options];
    updated[idx] = value;
    setOptions(updated);
  };

  /* ------------------ Source Handlers ------------------ */
  const handleAddSource = () => {
    setSources([...sources, ""]);
  };

  const handleSourceChange = (idx: number, value: string) => {
    const updated = [...sources];
    updated[idx] = value;
    setSources(updated);
  };

  /* ------------------ Base64 Converter ------------------ */
  const convertToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  /* ------------------ Submit ------------------ */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !summary.trim()) {
      alert("Title and summary are required");
      return;
    }


    const closeTimestamp = new Date(closeTime);

   if (closeTimestamp <= new Date()) {
  alert("Close time must be in the future");
  return;
}

    if (type === "options" && options.some((o) => !o.trim())) {
      alert("All options must be filled");
      return;
    }

// validations
  if (!title.trim() || !summary.trim()) {
    alert("Title and summary are required");
    return;
  }

  if (!category.trim()) {
    alert("Category is required");
    return;
  }

  // ✅ ADD HERE
  const normalizedCategory = category.trim();



    setLoading(true);

    try {
      /* 🔹 IMAGE → BASE64 */
      let imageBase64: string | null = null;

      if (imageFile) {
        if (imageFile.size > 100 * 1024) {
          alert("Image must be under 100KB");
          setLoading(false);
          return;
        }
        imageBase64 = await convertToBase64(imageFile);
      }

      const marketData: any = {
        title,
        summary,
        type,
        imageBase64,
        sources: sources.filter((s) => s.trim() !== ""),

        /* 🔐 MARKET SAFETY */
        status: "OPEN",
        resolved: false,
        winner: null,

        eventTime: serverTimestamp(),
        closeTime: Timestamp.fromDate(closeTimestamp),

        lockedAt: null,
        lockedBy: null,
        resolvedAt: null,
        resolvedBy: null,

        /* 🔎 DISCOVERY */
        category: normalizedCategory,
        featured: false,

        createdAt: serverTimestamp(),
        createdBy: user.uid,
      };

      if (type === "yesno") {
        marketData.yes = 0;
        marketData.no = 0;
      } else {
        marketData.options = options.map((opt) => ({
          id: uuid(),
          name: opt,
          votes: 0,
        }));
      }

      await addDoc(collection(db, "markets"), marketData);

      alert("Market created successfully!");
      router.push("/markets");
    } catch (error) {
      console.error(error);
      alert("Failed to create market");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------ UI ------------------ */
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow-md w-full max-w-md"
      >
        <h1 className="text-2xl font-bold mb-4 text-center">
          Create New Market
        </h1>

        {/* Market Title */}
        <input
          type="text"
          placeholder="Market Title"
          className="w-full p-2 border rounded mb-3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {/* Category */}
      <input
  type="text"
  placeholder="Category (e.g. Politics, Sports, Crypto)"
  className="w-full p-2 border rounded mb-3"
  value={category}
  onChange={(e) => setCategory(e.target.value)}
  required
/>


        

        {/* Close Time */}
        <label className="text-sm font-semibold">
          Betting Close Time
        </label>
        <input
          type="datetime-local"
          className="w-full border p-2 rounded mb-4"
          value={closeTime}
          onChange={(e) => setCloseTime(e.target.value)}
          required
        />

        {/* Image */}
        <div className="mb-4">
          <label className="font-semibold block mb-2">
            Market Image (optional)
          </label>

          <div className="flex items-center gap-3">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Preview"
                className="w-16 h-16 rounded object-cover border"
              />
            ) : (
              <div className="w-16 h-16 flex items-center justify-center border rounded text-xs text-gray-400">
                No Image
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImageFile(file);
                setImagePreview(URL.createObjectURL(file));
              }}
              className="text-sm"
            />
          </div>
        </div>

        {/* Summary */}
        <textarea
          placeholder="Market Summary"
          className="w-full p-2 border rounded mb-4"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          required
        />

        {/* Market Type */}
        <select
          className="w-full border p-2 rounded mb-4"
          value={type}
          onChange={(e) => setType(e.target.value as MarketType)}
        >
          <option value="yesno">Yes / No</option>
          <option value="options">Option-based</option>
        </select>

        {/* Options */}
        {type === "options" && (
          <div className="mb-4">
            <label className="font-semibold block mb-2">
              Market Options
            </label>

            {options.map((opt, idx) => (
              <input
                key={idx}
                className="border p-2 mb-2 w-full"
                placeholder={`Option ${idx + 1}`}
                value={opt}
                onChange={(e) => handleOptionChange(idx, e.target.value)}
                required
              />
            ))}

            <button
              type="button"
              onClick={handleAddOption}
              className="bg-blue-500 text-white px-4 py-2 rounded text-sm"
            >
              + Add Option
            </button>
          </div>
        )}

        {/* Sources */}
        <div className="mb-4">
          <label className="font-semibold block mb-2">
            Verification Sources
          </label>

          {sources.map((src, idx) => (
            <input
              key={idx}
              className="border p-2 mb-2 w-full"
              placeholder={`Source ${idx + 1}`}
              value={src}
              onChange={(e) => handleSourceChange(idx, e.target.value)}
            />
          ))}

          <button
            type="button"
            onClick={handleAddSource}
            className="text-sm bg-gray-200 px-3 py-1 rounded"
          >
            + Add Source
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white p-2 rounded hover:bg-gray-800"
        >
          {loading ? "Creating..." : "Create Market"}
        </button>
      </form>
    </div>
  );
}
