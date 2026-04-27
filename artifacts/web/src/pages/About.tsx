import { Link } from "react-router-dom";
import { Target, Compass, Heart, ArrowRight } from "lucide-react";

export default function About() {
  return (
    <>
      <section className="bg-gradient-to-b from-ink-900 to-ink-800 py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-brand-500/40">
            About Us
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl">
            A decade of stopping power, built in Pakistan.
          </h1>
          <p className="mt-5 text-lg text-ink-200">
            Tashi Brakes is a homegrown manufacturer of premium disc pads and brake pads — trusted
            by hundreds of retailers, distributors, and workshops across the country.
          </p>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[
            {
              icon: Target,
              title: "Our Mission",
              desc: "To make safe, dependable braking accessible to every vehicle on the road — without compromising on quality or fair pricing.",
            },
            {
              icon: Compass,
              title: "Our Vision",
              desc: "To become South Asia's most trusted brake-pad brand by combining engineering rigour with genuine partner relationships.",
            },
            {
              icon: Heart,
              title: "Our Promise",
              desc: "Every Tashi pad is QR-verified, performance-tested, and backed by a partner support team that picks up the phone.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-ink-100 bg-ink-50 p-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold text-ink-900">{item.title}</h3>
              <p className="mt-3 text-ink-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink-50 py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h2 className="font-display text-3xl font-bold text-ink-900">Our Story</h2>
            <div className="mt-6 space-y-4 text-ink-600">
              <p>
                Tashi started with a simple question: why should a part as critical as a brake pad
                be a coin-flip between safety and savings? Counterfeit pads were everywhere, and
                mechanics were paying the price in unhappy customers and avoidable comebacks.
              </p>
              <p>
                So we built Tashi from the ground up — sourcing materials we'd put in our own
                family's car, testing them under real Pakistani road conditions, and packaging
                every pad with a unique QR code that any mechanic can verify in seconds.
              </p>
              <p>
                Today, Tashi pads ride on thousands of cars from Karachi to Khyber and across
                borders. But we still answer the phone the same way we did on day one.
              </p>
            </div>
            <Link
              to="/team"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Meet the team
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-brand-500/20 blur-2xl" />
              <img
                src="/tashi-logo.png"
                alt="Tashi Brakes"
                className="relative h-64 w-64 rounded-3xl bg-white object-contain p-8 shadow-xl ring-1 ring-ink-100 sm:h-80 sm:w-80"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
