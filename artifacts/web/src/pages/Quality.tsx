import { CheckCircle2, FlaskConical, Microscope, Gauge, ShieldCheck, ClipboardCheck } from "lucide-react";

const tests = [
  {
    icon: FlaskConical,
    title: "Material Inspection",
    desc: "Every batch of friction material is sampled and inspected for composition, density, and consistency before it ever reaches the press.",
  },
  {
    icon: Gauge,
    title: "Performance Testing",
    desc: "Pads are tested for stopping power, fade resistance, and noise levels at the temperatures and pressures real Pakistani roads demand.",
  },
  {
    icon: Microscope,
    title: "Wear Analysis",
    desc: "We measure long-term wear patterns to make sure our pads outlast the competition by a significant margin in normal driving conditions.",
  },
  {
    icon: ShieldCheck,
    title: "QR Authenticity",
    desc: "Every retail pack carries a unique QR code that mechanics scan in our app to confirm it's a genuine Tashi product — not a counterfeit.",
  },
  {
    icon: ClipboardCheck,
    title: "Final Audit",
    desc: "Before shipment, every pallet passes a final visual and dimensional audit. Anything that doesn't meet spec gets pulled.",
  },
  {
    icon: CheckCircle2,
    title: "Field Feedback Loop",
    desc: "Our partner support team logs every claim and feedback so we keep improving the next batch — and the one after that.",
  },
];

export default function Quality() {
  return (
    <>
      <section className="bg-gradient-to-b from-ink-900 to-ink-800 py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-brand-500/40">
            Quality
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl">
            Tested where it matters.
          </h1>
          <p className="mt-5 text-lg text-ink-200">
            Six checkpoints between raw material and your shop floor — because braking is the
            one part you can't ask twice about.
          </p>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tests.map((t) => (
              <div
                key={t.title}
                className="rounded-2xl border border-ink-100 bg-ink-50 p-8 transition-all hover:border-brand-200 hover:bg-white hover:shadow-md"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white">
                  <t.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink-900">{t.title}</h3>
                <p className="mt-2 text-ink-500">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink-50 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-ink-900">A pad you can stand behind.</h2>
          <p className="mt-4 text-lg text-ink-600">
            If you ever receive a Tashi pad that doesn't perform as promised, our partner support
            team will make it right. Every time.
          </p>
        </div>
      </section>
    </>
  );
}
