import type { Metadata } from 'next';
import { getPublicSchoolSeoSummary } from '@/lib/school-seo';

interface SchoolLayoutProps {
  children: React.ReactNode;
  params: Promise<{ codigo_inep: string }>;
}

// O painel é montado no navegador; para buscadores, a versão canônica da escola
// é a página pública /ranking-enem/escola/{inep}.
export async function generateMetadata({ params }: SchoolLayoutProps): Promise<Metadata> {
  const { codigo_inep } = await params;
  const school = await getPublicSchoolSeoSummary(codigo_inep).catch(() => null);

  if (!school) return { robots: { index: false, follow: true } };

  return {
    title: `${school.nome_escola}: painel ENEM`,
    alternates: { canonical: `/ranking-enem/escola/${school.codigo_inep}` },
  };
}

export default function SchoolLayout({ children }: SchoolLayoutProps) {
  return children;
}
