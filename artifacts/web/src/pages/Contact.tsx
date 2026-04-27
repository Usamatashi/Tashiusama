import { useState } from "react";
import { Mail, Phone, MapPin, Send, MessageSquare } from "lucide-react";

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      <section className="bg-gradient-to-b from-ink-900 to-ink-800 py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-brand-500/40">
            Contact
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl">
            Let's talk brakes.
          </h1>
          <p className="mt-5 text-lg text-ink-200">
            Whether you're a retailer wanting to stock Tashi, a mechanic with a question, or just
            curious — we'd love to hear from you.
          </p>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-100 bg-ink-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink-900">Email us</h3>
                  <a href="mailto:tashibrakes@gmail.com" className="mt-1 block text-brand-600 hover:text-brand-700">
                    tashibrakes@gmail.com
                  </a>
                  <p className="mt-1 text-sm text-ink-500">We reply within one business day.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-ink-100 bg-ink-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink-900">Call or WhatsApp</h3>
                  <a href="tel:+923055198651" className="mt-1 block text-brand-600 hover:text-brand-700">
                    +92 305 5198651
                  </a>
                  <p className="mt-1 text-sm text-ink-500">Mon–Sat, 9am – 7pm PKT.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-ink-100 bg-ink-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink-900">Visit us</h3>
                  <p className="mt-1 text-ink-700">Pakistan</p>
                  <p className="mt-1 text-sm text-ink-500">Drop us a line to set up a meeting.</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-2 text-brand-600">
                <MessageSquare className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wider">Send us a message</span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold text-ink-900">How can we help?</h2>

              {submitted ? (
                <div className="mt-6 rounded-xl bg-brand-50 p-6 text-center">
                  <div className="font-display text-lg font-semibold text-brand-700">
                    Thanks for reaching out!
                  </div>
                  <p className="mt-2 text-sm text-brand-800">
                    Our team will email you back within one business day.
                  </p>
                </div>
              ) : (
                <form
                  className="mt-6 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSubmitted(true);
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-ink-700">Full name</label>
                      <input
                        required
                        type="text"
                        className="mt-1 block w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-700">Phone</label>
                      <input
                        required
                        type="tel"
                        className="mt-1 block w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        placeholder="+92 ..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700">Email</label>
                    <input
                      required
                      type="email"
                      className="mt-1 block w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700">I am a…</label>
                    <select className="mt-1 block w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200">
                      <option>Retailer</option>
                      <option>Mechanic / Workshop</option>
                      <option>Distributor</option>
                      <option>End consumer</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700">Message</label>
                    <textarea
                      required
                      rows={4}
                      className="mt-1 block w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      placeholder="Tell us about your enquiry…"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
                  >
                    <Send className="h-4 w-4" />
                    Send Message
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
