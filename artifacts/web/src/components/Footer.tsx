import { Link } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-ink-900 text-ink-200">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/tashi-logo.png" alt="Tashi Brakes" className="h-10 w-10 rounded-md bg-white p-1 object-contain" />
              <div>
                <div className="font-display text-xl font-bold text-white">Tashi</div>
                <div className="text-[11px] font-medium uppercase tracking-widest text-brand-400">Brakes</div>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm text-ink-300">
              Genuine brake parts. Trusted partners. Engineered for the roads we ride every day.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Company</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/about" className="text-ink-300 hover:text-brand-400">About Us</Link></li>
              <li><Link to="/team" className="text-ink-300 hover:text-brand-400">Our Team</Link></li>
              <li><Link to="/culture" className="text-ink-300 hover:text-brand-400">Culture</Link></li>
              <li><Link to="/quality" className="text-ink-300 hover:text-brand-400">Quality</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Shop</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/products" className="text-ink-300 hover:text-brand-400">All Products</Link></li>
              <li><Link to="/products" className="text-ink-300 hover:text-brand-400">Disc Pads</Link></li>
              <li><Link to="/products" className="text-ink-300 hover:text-brand-400">Brake Pads</Link></li>
              <li><Link to="/contact" className="text-ink-300 hover:text-brand-400">Become a Partner</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Contact</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li className="flex items-start gap-2 text-ink-300">
                <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-400" />
                <a href="mailto:tashibrakes@gmail.com" className="hover:text-brand-400">tashibrakes@gmail.com</a>
              </li>
              <li className="flex items-start gap-2 text-ink-300">
                <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-400" />
                <a href="tel:+923055198651" className="hover:text-brand-400">+92 305 5198651</a>
              </li>
              <li className="flex items-start gap-2 text-ink-300">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-400" />
                <span>Pakistan</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-ink-700 pt-8 md:flex-row md:items-center">
          <p className="text-xs text-ink-400">
            © {new Date().getFullYear()} Tashi Brakes. All rights reserved.
          </p>
          <div className="flex gap-5 text-xs text-ink-400">
            <a href="https://usamatashi.github.io/tashiwebapp/" target="_blank" rel="noreferrer" className="hover:text-brand-400">
              Privacy Policy
            </a>
            <a href="https://usamatashi.github.io/tashiwebapp/delete-account.html" target="_blank" rel="noreferrer" className="hover:text-brand-400">
              Delete Account
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
