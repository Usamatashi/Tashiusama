import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Truck,
  Award,
  Smartphone,
  ArrowRight,
  QrCode,
  Wrench,
  Users,
} from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    title: "Genuine Quality",
    description:
      "Every brake pad is built and tested to deliver consistent, reliable stopping power on Pakistan's roads.",
  },
  {
    icon: QrCode,
    title: "QR-Verified Authenticity",
    description:
      "Each pack carries a unique QR code so retailers and mechanics can confirm it's a real Tashi product.",
  },
  {
    icon: Award,
    title: "Loyalty Rewards",
    description:
      "Scan, earn, and redeem points on every Tashi purchase through our official mobile app.",
  },
  {
    icon: Truck,
    title: "Nationwide & International Shipping",
    description:
      "From Karachi to Khyber and beyond — we ship to retailers, mechanics, and distributors worldwide.",
  },
];

const stats = [
  { value: "10+", label: "Years in business" },
  { value: "500+", label: "Active partners" },
  { value: "50K+", label: "Pads produced monthly" },
  { value: "4.8★", label: "Partner rating" },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900 text-white">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_30%_20%,rgba(232,119,34,0.4),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(232,119,34,0.25),transparent_50%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-28 lg:px-8">
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-brand-500/40">
              Tashi Brakes Pakistan
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Genuine brake parts.
              <br />
              <span className="text-brand-400">Trusted partners.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-200">
              We make premium disc pads and brake pads — and back every box with a QR-verified
              authenticity guarantee, loyalty rewards, and partner support that mechanics and
              retailers actually rely on.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-brand-900/30 transition-colors hover:bg-brand-600"
              >
                Shop Brake Pads
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-6 py-3 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
              >
                Learn About Tashi
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="font-display text-2xl font-bold text-brand-400 sm:text-3xl">{s.value}</div>
                  <div className="mt-1 text-xs text-ink-300">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-brand-500/20 blur-3xl" />
              <div className="relative rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
                <img
                  src="/tashi-logo.png"
                  alt="Tashi Brakes"
                  className="h-56 w-56 rounded-2xl bg-white object-contain p-4 shadow-2xl sm:h-72 sm:w-72"
                />
                <div className="mt-6 text-center">
                  <p className="font-display text-lg font-semibold text-white">Engineered to Stop.</p>
                  <p className="mt-1 text-sm text-ink-300">Built to be Trusted.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">Why partners choose Tashi</h2>
            <p className="mt-4 text-lg text-ink-500">
              We don't just sell brake pads. We build a partnership — backed by quality,
              technology, and rewards that grow your business.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative rounded-2xl border border-ink-100 bg-white p-6 transition-all hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-100"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 group-hover:bg-brand-500 group-hover:text-white">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className="bg-ink-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">Built for everyone in the trade</h2>
            <p className="mt-4 text-lg text-ink-500">
              From workshop mechanics to multi-city distributors — Tashi works the way you do.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Wrench,
                title: "Mechanics",
                desc: "Scan a QR code with the Tashi app to verify the pad and earn points on every install.",
              },
              {
                icon: Users,
                title: "Retailers",
                desc: "Order online, track shipments, manage your inventory and reach more customers.",
              },
              {
                icon: Smartphone,
                title: "Salesmen & Admins",
                desc: "One app and one dashboard for orders, claims, regions, ads, and team performance.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-ink-100">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white">
                  <item.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-6 font-display text-xl font-semibold text-ink-900">{item.title}</h3>
                <p className="mt-3 text-ink-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-brand-500 py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
              Ready to stock genuine Tashi brake pads?
            </h2>
            <p className="mt-2 text-brand-50">Order online for fast nationwide and international delivery.</p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-base font-semibold text-brand-600 shadow-md transition-colors hover:bg-ink-50"
            >
              Browse Products
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
