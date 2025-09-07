import React, { useEffect, useState } from "react";

// Base API URL
const BASE_URL = "https://villagerelocation.onrender.com/maati";

export default function LandingPage() {
  const [loading, setLoading] = useState(true);
  const [guidelines, setGuidelines] = useState(null);
  const [aboutUs, setAboutUs] = useState(null);
  const [contact, setContact] = useState(null);
  const [faq, setFaq] = useState(null);

  // Splash screen timeout
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch APIs
  useEffect(() => {
    fetch({BASE_URL}/guidelines)
      .then((res) => res.json())
      .then((data) => setGuidelines(data.result));

    fetch({BASE_URL}/aboutUs)
      .then((res) => res.json())
      .then((data) => setAboutUs(data.result));

    fetch({BASE_URL}/contactUs)
      .then((res) => res.json())
      .then((data) => setContact(data.result));

    fetch({BASE_URL}/faq)
      .then((res) => res.json())
      .then((data) => setFaq(data.result));
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <img
            src="/logo.png" // your logo file
            alt="Village Relocation Logo"
            className="mx-auto h-24 w-24"
          />
          <h1 className="mt-4 text-2xl font-bold text-gray-800">
            Village Relocation Authority
          </h1>
          <p className="text-gray-600">Ensuring Transparency & Fair Relocation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans">
      {/* Header */}
      <header className="flex items-center justify-between bg-[#0d3b66] px-8 py-4 text-white shadow">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="h-12 w-12" />
          <h1 className="text-xl font-bold">
            Village Relocation Monitoring System
          </h1>
        </div>
        <nav className="hidden md:flex gap-6">
          <a href="#guidelines" className="hover:underline">Guidelines</a>
          <a href="#about" className="hover:underline">About Us</a>
          <a href="#faq" className="hover:underline">FAQs</a>
          <a href="#contact" className="hover:underline">Contact</a>
        </nav>
      </header>

      {/* Horizontal scrolling banner */}
      <div className="overflow-hidden bg-gray-100 py-3">
        <div className="flex animate-scroll-x gap-8">
          <img src="/banner1.png" alt="banner1" className="h-28" />
          <img src="/banner2.png" alt="banner2" className="h-28" />
          <img src="/banner3.png" alt="banner3" className="h-28" />
          <img src="/banner4.png" alt="banner4" className="h-28" />
        </div>
      </div>

      {/* Main content */}
      <main className="mx-auto max-w-6xl p-6">
        {/* Guidelines */}
        <section id="guidelines" className="my-10">
          <h2 className="mb-4 text-2xl font-bold text-[#0d3b66]">Relocation Guidelines</h2>
          {guidelines ? (
            <>
              <h3 className="text-lg font-semibold">{guidelines.title}</h3>
              <p className="text-gray-700">{guidelines.content}</p>
              <ul className="mt-4 list-disc pl-6 text-gray-700">
                {guidelines.sections?.map((s, i) => (
                  <li key={i}>
                    <strong>{s.title}:</strong> {s.content}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>Loading...</p>
          )}
        </section>

        {/* About Us */}
        <section id="about" className="my-10">
          <h2 className="mb-4 text-2xl font-bold text-[#0d3b66]">About Us</h2>
          {aboutUs ? (
            <div>
              <p className="text-gray-700">{aboutUs.history}</p>
              <p className="mt-2 font-semibold text-gray-800">Mission: {aboutUs.mission}</p>
              <p className="font-semibold text-gray-800">Vision: {aboutUs.vision}</p>
              <h3 className="mt-4 font-semibold">Achievements:</h3>
              <ul className="list-disc pl-6 text-gray-700">
                {aboutUs.achievements?.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p>Loading...</p>
          )}
        </section>

        {/* FAQ */}
        <section id="faq" className="my-10">
          <h2 className="mb-4 text-2xl font-bold text-[#0d3b66]">Frequently Asked Questions</h2>
          {faq ? (
            faq.categories?.map((cat, i) => (
              <div key={i} className="mb-6">
                <h3 className="font-semibold text-lg">{cat.categoryName}</h3>
                <ul className="mt-2 list-disc pl-6 text-gray-700">
                  {cat.questions.map((q, j) => (
                    <li key={j}>
                      <p className="font-medium">{q.question}</p>
                      <p className="text-gray-600">{q.answer}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p>Loading...</p>
          )}
        </section>

        {/* Contact */}
        <section id="contact" className="my-10">
          <h2 className="mb-4 text-2xl font-bold text-[#0d3b66]">Contact Us</h2>
          {contact ? (
            <div className="space-y-2 text-gray-700">
              <p><strong>HQ:</strong> {contact.headquarters.address}</p>
              <p>Email: {contact.headquarters.email}</p>
              <p>Phone: {contact.headquarters.phone}</p>
              <p>Working Hours: {contact.workingHours}</p>
            </div>
          ) : (
            <p>Loading...</p>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#0d3b66] p-6 text-center text-white">
        © {new Date().getFullYear()} Village Relocation Authority · All Rights Reserved
      </footer>

      {/* Tailwind scroll animation */}
      <style>
        {`
        @keyframes scroll-x {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll-x {
          animation: scroll-x 20s linear infinite;
          width: max-content;
        }
        `}
      </style>
    </div>
  );
}