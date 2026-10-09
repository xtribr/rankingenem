import type { FaqItem } from '@/lib/ranking-faq';

export default function FaqSection({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="perguntas-frequentes">
      <h2 id="perguntas-frequentes" className="text-2xl font-black">Perguntas frequentes</h2>
      <dl className="mt-4 divide-y divide-slate-100">
        {items.map(({ question, answer }) => (
          <div key={question} className="py-4">
            <dt className="font-bold text-slate-900">{question}</dt>
            <dd className="mt-2 text-sm leading-7 text-slate-600">{answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
