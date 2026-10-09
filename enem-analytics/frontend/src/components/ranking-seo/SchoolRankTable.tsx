import Link from 'next/link';
import { formatScore, type RankedSchool } from '@/lib/ranking-geo';

export default function SchoolRankTable({
  schools,
  showMunicipio = false,
}: {
  schools: RankedSchool[];
  showMunicipio?: boolean;
}) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-xs font-bold uppercase tracking-wider text-slate-500">
          <tr className="border-b border-slate-200">
            <th scope="col" className="py-3 pr-3">#</th>
            <th scope="col" className="py-3 pr-3">Escola</th>
            {showMunicipio ? <th scope="col" className="py-3 pr-3">Município</th> : null}
            <th scope="col" className="py-3 pr-3">Rede</th>
            <th scope="col" className="py-3 pr-3 text-right">Brasil</th>
            <th scope="col" className="py-3 text-right">Média</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((school, index) => (
            <tr key={school.codigo_inep} className="border-b border-slate-100">
              <td className="py-3 pr-3 font-bold text-slate-500">{index + 1}</td>
              <td className="py-3 pr-3">
                <Link href={`/ranking-enem/escola/${school.codigo_inep}`} className="font-semibold text-[#0f6f96] hover:underline">
                  {school.nome_escola}
                </Link>
              </td>
              {showMunicipio ? <td className="py-3 pr-3 text-slate-600">{school.municipio ?? '—'}</td> : null}
              <td className="py-3 pr-3 text-slate-600">{school.tipo_escola ?? '—'}</td>
              <td className="py-3 pr-3 text-right text-slate-600">{school.ultimo_ranking ? `#${school.ultimo_ranking}` : '—'}</td>
              <td className="py-3 text-right font-black">{formatScore(school.ultima_nota)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
