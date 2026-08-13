"use client";

import { useState } from "react";
import { Mail, Phone, MapPin, Clock3, Send, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contentApi, ApiError } from "@/lib/api";

const contactInfo = [
  {
    icon: Phone,
    title: "Phone",
    lines: ["+1 (800) 123-4567", "+1 (800) 765-4321"],
  },
  {
    icon: Mail,
    title: "Email",
    lines: ["info@oncohealthmart.com", "support@oncohealthmart.com"],
  },
  {
    icon: MapPin,
    title: "Address",
    lines: ["123 Medical Plaza, Suite 400", "New York, NY 10001, USA"],
  },
  {
    icon: Clock3,
    title: "Working Hours",
    lines: ["Mon – Fri: 9:00 AM – 6:00 PM", "Sat: 10:00 AM – 4:00 PM"],
  },
];

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.MouseEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await contentApi.submitEnquiry({
        name: form.name,
        email: form.email,
        issue: form.subject,
        message: form.message,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-[var(--paper)] pb-20">
      {/* Page hero */}
      <div className="bg-[var(--ink)] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-500)]">Get In Touch</p>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Contact Us</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/60">
            Have a question, prescription query, or need delivery support? Our team is ready to help.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Info cards */}
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {contactInfo.map(({ icon: Icon, title, lines }) => (
            <div
              key={title}
              className="flex flex-col items-start gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--blue-50)]">
                <Icon size={20} className="text-[var(--blue-500)]" />
              </div>
              <p className="text-sm font-bold text-[var(--ink)]">{title}</p>
              {lines.map((l) => (
                <p key={l} className="text-sm leading-snug text-[var(--ink-soft)]">{l}</p>
              ))}
            </div>
          ))}
        </div>

        {/* Map + Form */}
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Map embed */}
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-white shadow-sm">
            <iframe
              title="Our Location"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.215573291865!2d-73.98784368459423!3d40.75773167932669!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c25855c6480299%3A0x55194ec5a1ae072e!2sTimes%20Square!5e0!3m2!1sen!2sus!4v1614000000000"
              className="h-64 w-full border-0 lg:h-full lg:min-h-[400px]"
              loading="lazy"
              allowFullScreen
            />
          </div>

          {/* Contact form */}
          <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-8 shadow-sm">
            {sent ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center">
                <CheckCircle2 size={52} className="text-[var(--blue-500)]" />
                <h2 className="text-xl font-bold text-[var(--ink)]">Message Sent!</h2>
                <p className="max-w-xs text-sm text-[var(--ink-soft)]">
                  Thank you for reaching out. We'll get back to you within 24 hours.
                </p>
                <button
                  onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                  className="mt-2 text-sm font-medium text-[var(--blue-500)] hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h2 className="mb-6 text-xl font-bold text-[var(--ink)]">Send Us a Message</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">Full Name</label>
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="John Doe"
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--blue-500)] focus:ring-2 focus:ring-[var(--blue-500)]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">Email Address</label>
                      <input
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="john@email.com"
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--blue-500)] focus:ring-2 focus:ring-[var(--blue-500)]/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">Subject</label>
                    <select
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--blue-500)] focus:ring-2 focus:ring-[var(--blue-500)]/20"
                    >
                      <option value="">Select a subject</option>
                      <option>Order Issue</option>
                      <option>Prescription Query</option>
                      <option>Product Information</option>
                      <option>Returns & Refunds</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">Message</label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      rows={5}
                      placeholder="How can we help you?"
                      className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--blue-500)] focus:ring-2 focus:ring-[var(--blue-500)]/20"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-[var(--coral-500)]">{error}</p>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={sending}
                    className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--blue-500)] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(46,159,227,0.55)] transition hover:bg-[var(--blue-600)] active:scale-[0.98] disabled:opacity-60"
                  >
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    {sending ? "Sending…" : "Send Message"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
