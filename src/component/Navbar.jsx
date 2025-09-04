import React from "react";

export default function MainNavbar({ name = "$Name", logoUrl = "/images/logo.png" }) {
  return (
    <header className="bg-[#a7dec0] w-full">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between py-3">
          {/* Left side: logo + Welcome */}
          <div className="flex items-center gap-4">
            {/* Show full image (no rounding, larger size) */}
            <img
              src={logoUrl}
              alt="logo"
              className="w-20 h-20 object-contain" // ✅ bigger (80x80px) and full image
            />

            {/* Welcome text */}
            <h1 className="text-2xl font-bold text-black">Welcome {name}</h1>
          </div>

          {/* Right side: MAATI text */}
          <div className="text-right">
            <div className="text-[#4a3529] font-bold text-2xl leading-none">
              माटी
            </div>
            <div className="text-sm text-[#4a3529] tracking-wider">MAATI</div>
          </div>
        </div>
      </div>
    </header>
  );
}
