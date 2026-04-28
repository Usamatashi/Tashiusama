import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Package, Info, Loader2 } from "lucide-react";

type ApiProduct = {
  id: number;
  name: string;
  salesPrice: number;
  category: "disc_pad" | "brake_shoes" | "other" | string;
  productNumber: string | null;
  vehicleManufacturer: string | null;
  imageUrl: string | null;
};

type DisplayProduct = {
  key: string;
  sku: string;
  name: string;
  fit: string;
  price: number;
  badge?: string;
  imageUrl?: string | null;
};

const fallbackProducts: DisplayProduct[] = [
  {
    key: "TSH-DP-001",
    sku: "TSH-DP-001",
    name: "Tashi Disc Pad — Standard",
    fit: "Suzuki Mehran / Cultus / Bolan",
    price: 1850,
    badge: "Bestseller",
  },
  {
    key: "TSH-DP-002",
    sku: "TSH-DP-002",
    name: "Tashi Disc Pad — Premium",
    fit: "Toyota Corolla 2014–2024",
    price: 2950,
    badge: "Premium",
  },
  {
    key: "TSH-DP-003",
    sku: "TSH-DP-003",
    name: "Tashi Disc Pad — Heavy Duty",
    fit: "Toyota Hilux / Vigo / Revo",
    price: 4250,
    badge: "Heavy Duty",
  },
  {
    key: "TSH-BP-101",
    sku: "TSH-BP-101",
    name: "Tashi Brake Pad — Compact",
    fit: "Honda City / Civic 1.5",
    price: 2450,
  },
  {
    key: "TSH-BP-102",
    sku: "TSH-BP-102",
    name: "Tashi Brake Pad — Sedan",
    fit: "Honda Civic 1.8 / Accord",
    price: 3150,
  },
  {
    key: "TSH-BP-103",
    sku: "TSH-BP-103",
    name: "Tashi Brake Pad — SUV",
    fit: "Toyota Fortuner / Land Cruiser",
    price: 4850,
    badge: "SUV",
  },
];

const CATEGORY_BADGE: Record<string, string> = {
  disc_pad: "Disc Pad",
  brake_shoes: "Brake Shoes",
};

function mapApiProduct(p: ApiProduct): DisplayProduct {
  const sku = p.productNumber?.trim() || `TSH-${String(p.id).padStart(4, "0")}`;
  const fit = p.vehicleManufacturer?.trim() || "Universal fit";
  const badge = CATEGORY_BADGE[p.category];
  return {
    key: `api-${p.id}`,
    sku,
    name: p.name,
    fit,
    price: Number(p.salesPrice) || 0,
    badge,
    imageUrl: p.imageUrl,
  };
}

export default function Products() {
  const [products, setProducts] = useState<DisplayProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/products/public", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ApiProduct[] = await res.json();
        if (cancelled) return;
        if (!Array.isArray(data) || data.length === 0) {
          setProducts(fallbackProducts);
          setUsingFallback(true);
        } else {
          setProducts(data.map(mapApiProduct));
          setUsingFallback(false);
        }
      } catch {
        if (cancelled) return;
        setProducts(fallbackProducts);
        setUsingFallback(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <section className="bg-gradient-to-b from-ink-900 to-ink-800 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-brand-500/40">
              Products
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
              Brake pads & disc pads
            </h1>
            <p className="mt-4 text-lg text-ink-200">
              Genuine Tashi parts for the most popular vehicles on Pakistani roads — and beyond.
              Cash on Delivery, Easypaisa, and JazzCash all accepted.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
            <Info className="h-5 w-5 flex-shrink-0 text-brand-600" />
            <span>
              <strong>Coming soon:</strong> Add to cart, sign up, and pay online with Easypaisa /
              JazzCash / COD. For now,{" "}
              <Link to="/contact" className="font-semibold underline">
                contact our sales team
              </Link>{" "}
              to place an order.
            </span>
          </div>

          {usingFallback && !loading && (
            <div className="mb-6 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-xs text-ink-500">
              Showing our featured catalog. Live inventory will appear here as soon as products are
              added in the Tashi admin app.
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24 text-ink-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-3 text-sm">Loading products…</span>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <div
                  key={p.key}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white transition-all hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg"
                >
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-ink-100 to-ink-50">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <Package className="h-24 w-24 text-ink-300 transition-colors group-hover:text-brand-400" />
                    )}
                    {p.badge && (
                      <span className="absolute top-3 left-3 rounded-full bg-brand-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                      {p.sku}
                    </div>
                    <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">
                      {p.name}
                    </h3>
                    <p className="mt-1 text-sm text-ink-500">Fits: {p.fit}</p>
                    <div className="mt-auto flex items-end justify-between pt-5">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wider text-ink-400">
                          Price
                        </div>
                        <div className="font-display text-xl font-bold text-ink-900">
                          Rs. {p.price.toLocaleString()}
                        </div>
                      </div>
                      <button
                        disabled
                        className="inline-flex items-center gap-1.5 rounded-md bg-ink-100 px-3 py-2 text-xs font-semibold text-ink-400"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Soon
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
