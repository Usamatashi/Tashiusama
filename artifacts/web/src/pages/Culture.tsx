import { Handshake, Lightbulb, ShieldCheck, Sparkles, Users, Leaf } from "lucide-react";

const values = [
  {
    icon: ShieldCheck,
    title: "Safety First, Always",
    desc: "Every decision starts with the question: is this safe enough for our own family's car? If the answer is no, we don't ship it.",
  },
  {
    icon: Handshake,
    title: "Partners, Not Customers",
    desc: "Our retailers and mechanics are partners in our growth. We invest in their success — through fair pricing, training, and loyalty rewards.",
  },
  {
    icon: Lightbulb,
    title: "Smart by Default",
    desc: "From QR-verified packaging to a mobile app that works offline, we use technology to make trade easier — not flashier.",
  },
  {
    icon: Sparkles,
    title: "Quality is the Brand",
    desc: "We're known for one thing: brake pads that perform consistently. Everything else is built on that foundation.",
  },
  {
    icon: Users,
    title: "Pick Up the Phone",
    desc: "When a partner has a problem, a real person at Tashi answers. No tickets, no bots — just a conversation.",
  },
  {
    icon: Leaf,
    title: "Built to Last",
    desc: "Long-lasting pads mean fewer replacements, less waste, and more trust. We measure success by how long our pads stay on the road.",
  },
];

export default function Culture() {
  return (
    <>
      <section className="bg-gradient-to-b from-ink-900 to-ink-800 py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-brand-500/40">
            Our Culture
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl">
            What we believe in.
          </h1>
          <p className="mt-5 text-lg text-ink-200">
            Six values that shape how we manufacture, sell, and support every Tashi brake pad.
          </p>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {values.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-ink-100 bg-white p-8 transition-all hover:border-brand-200 hover:shadow-lg"
              >
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <v.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-6 font-display text-lg font-semibold text-ink-900">{v.title}</h3>
                <p className="mt-2 text-ink-500">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
