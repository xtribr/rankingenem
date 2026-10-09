import Image from 'next/image';
import Link from 'next/link';

export interface Crumb {
  name: string;
  href?: string;
}

const BASE_URL = 'https://app.rankingenem.com';

export function breadcrumbJsonLd(crumbs: Crumb[], currentPath: string) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${BASE_URL}${crumb.href ?? currentPath}`,
    })),
  };
}

export default function RankingSeoShell({
  crumbs,
  children,
}: {
  crumbs: Crumb[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7fafc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 font-black">
            <Image src="/logo-x.png" alt="XTRI" width={36} height={36} className="h-9 w-9 object-contain" priority />
            Ranking ENEM XTRI
          </Link>
          <Link href="/cadastro" className="hidden rounded-xl bg-[#FF4B2E] px-4 py-2 text-sm font-bold text-white sm:inline-flex">
            Analisar minha escola
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
          {crumbs.map((crumb, index) => (
            <span key={crumb.href ?? 'current'}>
              {index > 0 ? <span aria-hidden="true"> / </span> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="font-semibold text-[#139ED3] hover:underline">{crumb.name}</Link>
              ) : (
                <span>{crumb.name}</span>
              )}
            </span>
          ))}
        </nav>
        {children}
      </main>
    </div>
  );
}
