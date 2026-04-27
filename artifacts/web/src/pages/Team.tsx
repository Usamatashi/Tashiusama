import { Mail } from "lucide-react";

const team = [
  { name: "Usama Tashi", role: "Founder & Chief Executive", initial: "UT" },
  { name: "Operations Lead", role: "Manufacturing & Quality", initial: "OL" },
  { name: "Sales Director", role: "Trade Partner Relations", initial: "SD" },
  { name: "Tech Lead", role: "App & Digital Platforms", initial: "TL" },
  { name: "Logistics Manager", role: "National & International Shipping", initial: "LM" },
  { name: "Customer Success", role: "Mechanic & Retailer Support", initial: "CS" },
];

export default function Team() {
  return (
    <>
      <section className="bg-gradient-to-b from-ink-900 to-ink-800 py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-brand-500/40">
            Our Team
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl">
            The people behind every pad.
          </h1>
          <p className="mt-5 text-lg text-ink-200">
            A small, dedicated team of engineers, sales people, and partner-support specialists who
            care about getting brake pads right.
          </p>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member) => (
              <div
                key={member.name}
                className="group rounded-2xl border border-ink-100 bg-ink-50 p-8 text-center transition-all hover:-translate-y-1 hover:border-brand-200 hover:bg-white hover:shadow-lg"
              >
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-display text-3xl font-bold text-white shadow-lg">
                  {member.initial}
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold text-ink-900">{member.name}</h3>
                <p className="mt-1 text-sm text-brand-600">{member.role}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-3xl bg-gradient-to-br from-ink-900 to-brand-900 p-10 text-center text-white sm:p-14">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Want to work with us?</h2>
            <p className="mt-3 text-ink-200">
              We're always looking for people who care about doing the small things right.
            </p>
            <a
              href="mailto:tashibrakes@gmail.com"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-brand-600"
            >
              <Mail className="h-4 w-4" />
              tashibrakes@gmail.com
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
