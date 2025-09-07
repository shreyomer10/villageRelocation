// src/components/FamilyModal.jsx
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Props:
 * - familyId (string) OR familyid (string) - provided by parent
 * - onClose (function)
 *
 * Example parent usage:
 * <FamilyModal familyId={selectedFamilyId} onClose={() => setShowModal(false)} />
 */
export default function FamilyModal({ familyId, familyid, onClose }) {
  const id = familyId ?? familyid; // accept either prop name
  const [data, setData] = useState(null); // will hold result object from API
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchFamily() {
      setLoading(true);
      setError(null);
      setData(null);
const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
const headers = token
  ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  : { "Content-Type": "application/json" };
      try {
        const res = await fetch(
          `https://villagerelocation.onrender.com/families/${encodeURIComponent(
            id
          )}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            signal,
          }
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `Failed to fetch family (${res.status}) ${res.statusText} ${text}`
          );
        }

        const json = await res.json();
        // expected response shape (example provided by you):
        // { error: false, message: 'Fetched Successfully', result: { ... } }
        const result = json?.result ?? json;

        setData(result);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Family fetch error:", err);
          setError(err.message || "Failed to fetch family details.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchFamily();
    return () => controller.abort();
  }, [id]);

  // helpers
  const members = Array.isArray(data?.members) ? data.members : [];
  const mukhiyaName = data?.mukhiyaName ?? data?.mukhiyaName ?? "Unknown";
  const mukhiyaPhoto = data?.mukhiyaPhoto ?? "/images/default-avatar.png";
  const mukhiyaAge = data?.mukhiyaAge ?? data?.mukhiyaAge ?? "—";
  const mukhiyaHealth = data?.mukhiyaHealth ?? "—";
  const familyIdentifier = data?.familyId ?? data?.familyId ?? "—";
  const photos = Array.isArray(data?.photos) ? data.photos : [];
  const landPhoto = photos[0] ?? "/images/default-land.png";
  const docs = Array.isArray(data?.docs) ? data.docs : [];
  const updatedAt = data?.updatedAt ? new Date(data.updatedAt) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl">
        <div className="rounded-3xl bg-white p-6 shadow-2xl border-2 border-gray-200">
          <button
            onClick={onClose}
            className="absolute right-6 top-6 bg-white p-2 rounded-full shadow hover:bg-gray-50"
            aria-label="Close"
            title="Close"
          >
            <X />
          </button>

          <div className="rounded-2xl border-2 border-gray-100 p-6 bg-white">
            {loading ? (
              <div className="py-20 text-center text-gray-600">
                Loading family details…
              </div>
            ) : error ? (
              <div className="py-8 text-center text-red-600">
                {error}
              </div>
            ) : data ? (
              <div className="flex flex-col gap-6">
                {/* Top row */}
                <div className="flex gap-6 items-start">
                  {/* Left column */}
                  <div className="flex-1">
                    {/* Mukhiya */}
                    <div className="flex items-center gap-4 mb-6">
                      <img
                        src={mukhiyaPhoto}
                        onError={(e) =>
                          (e.currentTarget.src = "/images/default-avatar.png")
                        }
                        alt={mukhiyaName}
                        className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md"
                      />
                      <div>
                        <div className="text-xl font-bold">
                          {mukhiyaName}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Age: {mukhiyaAge ?? "—"}
                        </div>
                        <div className="text-sm text-gray-600">
                          Health Status: {mukhiyaHealth ?? "—"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Family ID: {familyIdentifier}
                        </div>
                      </div>
                    </div>

                    {/* Members */}
                    <div className="grid grid-cols-3 gap-4">
                      {members.length > 0 ? (
                        members.slice(0, 6).map((m, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 bg-gray-50 p-3 rounded-md"
                          >
                            <img
                              src={m.photo ?? "/images/default-avatar.png"}
                              onError={(e) =>
                                (e.currentTarget.src =
                                  "/images/default-avatar.png")
                              }
                              alt={m.name ?? m.memberName ?? "Member"}
                              className="w-12 h-12 rounded-full object-cover border"
                            />
                            <div>
                              <div className="text-sm font-medium">
                                {m.name ?? m.memberName ?? "Member"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {m.age ? `${m.age} yrs` : ""}
                                {m.relation ? ` • ${m.relation}` : ""}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500">
                          No members listed.
                        </div>
                      )}
                    </div>

                    {/* Documents (if any) */}
                    {docs.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-semibold mb-2">
                          Documents
                        </div>
                        <div className="flex flex-col gap-2">
                          {docs.map((d, i) => (
                            <a
                              key={i}
                              href={d}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View document {i + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right column - Geo image */}
                  <div className="w-1/3 min-w-[220px]">
                    <div className="text-md font-semibold mb-3">
                      Geo tagged Photos of Land Provided
                    </div>
                    <div
                      className="w-full h-44 rounded-lg overflow-hidden shadow-inner border border-gray-100 bg-gray-100 cursor-pointer"
                      title="Open full size"
                      onClick={() => {
                        if (landPhoto && landPhoto !== "/images/default-land.png") {
                          window.open(landPhoto, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      <img
                        src={landPhoto}
                        alt="geo"
                        className="w-full h-full object-cover"
                        onError={(e) =>
                          (e.currentTarget.src = "/images/default-land.png")
                        }
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Tap image to view full size
                    </div>
                  </div>
                </div>

                {/* Other details */}
                <div className="mt-4">
                  <div className="rounded-full bg-gray-50 border border-gray-200 py-8 px-6 text-center shadow-sm">
                    <div className="text-2xl font-bold text-gray-700">
                      other details
                    </div>
                    <div className="mt-3 text-sm text-gray-500">
                      Mukhiya ID: {data?.mukhiyaId ?? "—"} • Updated:{" "}
                      {updatedAt ? updatedAt.toLocaleDateString() : "—"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                No details to show.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
