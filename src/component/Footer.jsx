// src/components/Footer.jsx
import React from "react";

export default function Footer() {
  return (
    <footer className="bg-[#064f3b] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Left column: logo + description */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src="/images/logo.png"
                alt="Village Relocation Authority logo"
                className="h-12 w-12 rounded-full border border-white/20"
              />
              <div>
                <div className="font-semibold">Forest Department</div>
                <div className="text-xs opacity-80">Wildlife Damage Compensation</div>
              </div>
            </div>

            <p className="text-sm text-white/85 max-w-sm">
              Providing support and compensation to communities affected by wildlife
              damage since 1995.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm text-white/90">
              <li>
                <a href="/" className="hover:underline">Home</a>
              </li>
              <li>
                <a href="/login" className="hover:underline">Login</a>
              </li>
              <li>
                <a href="#guidelines" className="hover:underline">File a Complaint</a>
              </li>
              <li>
                <a href="#faq" className="hover:underline">Contact Us</a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-3">Resources</h4>
            <ul className="space-y-2 text-sm text-white/90">
              <li>
                <a href="#guidelines" className="hover:underline">Wildlife Protection Act</a>
              </li>
              <li>
                <a href="#guidelines" className="hover:underline">Compensation Guidelines</a>
              </li>
              <li>
                <a href="#about" className="hover:underline">Documentation Checklist</a>
              </li>
              <li>
                <a href="#faq" className="hover:underline">Research Publications</a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-white/90">
              <li>
                <a href="#faq" className="hover:underline">FAQ</a>
              </li>
              <li>
                <a href="#contact" className="hover:underline">Help Center</a>
              </li>
              <li>
                <a href="#contact" className="hover:underline">Emergency Contacts</a>
              </li>
              <li>
                <a href="#contact" className="hover:underline">Feedback</a>
              </li>
            </ul>
          </div>
        </div>

        <hr className="my-6 border-white/10" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-sm text-white/80">
            Â© {new Date().getFullYear()} Forest Department, Government of Chhattisgarh. All rights reserved.
          </div>

          <div className="flex items-center gap-4 text-sm text-white/80">
            <a href="/privacy" className="hover:underline">Privacy Policy</a>
            <a href="/terms" className="hover:underline">Terms of Use</a>
            <a href="/accessibility" className="hover:underline">Accessibility</a>
            <a href="/sitemap" className="hover:underline">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
