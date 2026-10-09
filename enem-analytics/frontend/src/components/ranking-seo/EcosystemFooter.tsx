const LINKS = [
  { href: 'https://xtrisisu.com/', label: 'Simulador SISU e notas de corte' },
  { href: 'https://xtri.online/simulador-tri/', label: 'Simulador TRI ENEM' },
  { href: 'https://xtri.online/', label: 'XTRI' },
];

export default function EcosystemFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Ranking ENEM XTRI · dados dos microdados oficiais do INEP.</p>
        <nav aria-label="Outras ferramentas da XTRI" className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map(({ href, label }) => (
            <a key={href} href={href} className="font-semibold text-[#0f6f96] hover:underline">
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
