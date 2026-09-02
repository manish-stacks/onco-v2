"use client";

import { FaWhatsapp } from "react-icons/fa6";

const WHATSAPP_NUMBER = "919289008182"; // country code + number, no + or spaces

export function WhatsappFloat() {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-24 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
    >
      <FaWhatsapp size={30} />
    </a>
  );
}
