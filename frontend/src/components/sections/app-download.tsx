import { BadgeCheck } from "lucide-react";

const PLAY_URL = "https://play.google.com/store/search?q=oncohealth+mart&c=apps&hl=en";
const APPLE_URL = "https://apps.apple.com/in/app/onco-healthmart/id6754275714";

const points = [
  "Genuine medicines delivered all over India",
  "Sourced directly from reputable manufacturers",
  "Efficient storage for temperature-sensitive medicines",
];

export function AppDownload() {
  return (
    <section className="bg-white py-12">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <h2 className="font-display text-3xl font-medium leading-tight text-[var(--ink)] sm:text-4xl">
            Download the Onco Health Mart App For <span className="text-[var(--blue-500)]">Super-Fast</span> Delivery!
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--ink)]">
            Onco Health Mart is India&apos;s trusted online pharmacy for super speciality medicines, offering an extensive range of drugs that cater to diverse health needs across the country.
          </p>
          <ul className="mt-4 space-y-2.5">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-base text-[var(--ink)]">
                <BadgeCheck size={22} className="shrink-0 fill-[var(--blue-500)] text-white" /> {p}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/app-qr.svg" alt="Scan to download the app" className="h-24 w-24" />
            <a href={PLAY_URL} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/play-badge.png" alt="Get it on Google Play" className="h-11 w-auto" />
            </a>
            <a href={APPLE_URL} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/app-store-badge.png" alt="Download on the App Store" className="h-11 w-auto" />
            </a>
          </div>
          <p className="mt-3 text-base text-[var(--ink-soft)]">Available on Google Play &amp; App Store</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/app-mockup.jpg" alt="Onco Health Mart app screens" className="hidden max-h-[420px] w-full rounded-2xl object-cover object-center lg:block" />
      </div>
    </section>
  );
}
