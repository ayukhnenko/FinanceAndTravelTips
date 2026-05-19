import { notFound } from "next/navigation";
import Link from "next/link";
import { calculatorInfo, type CalculatorInfoKey } from "@/lib/calculator-info";

const calculatorPaths: Record<CalculatorInfoKey, string> = {
  early_repay: "/",
  bonds_cover: "/bonds",
  card_benefit: "/credit-card-benefit",
  mortgage_sale: "/mortgage-sale",
  mortgage_conditions_compare: "/mortgage-conditions-compare",
  rent_vs_buy: "/rent-vs-buy",
  compound: "/compound",
  discounting: "/discounting",
  loan: "/loan",
};

const calculatorTitles: Record<CalculatorInfoKey, string> = {
  early_repay: "Выгодно ли гасить кредит досрочно",
  bonds_cover: "Сколько инвестиций нужно, чтобы покрыть кредит",
  card_benefit: "Выгода от оплаты кредиткой",
  mortgage_sale: "Выгодно ли продавать квартиру в ипотеке",
  mortgage_conditions_compare: "Сравнение ипотечных условий",
  rent_vs_buy: "Аренда против покупки",
  compound: "Калькулятор сложных процентов",
  discounting: "Дисконтирование — будущая стоимость денег",
  loan: "Кредитный калькулятор",
};

type PageProps = {
  params: { key: string };
};

export default function CalculatorInfoPage({ params }: PageProps) {
  const key = params.key as CalculatorInfoKey;
  const info = calculatorInfo[key];
  if (!info) notFound();

  const title = calculatorTitles[key];
  const calculatorPath = calculatorPaths[key];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
        {title}
      </h1>

      <div className="card-panel mt-6 space-y-4">
        {info.fullRu.map((paragraph) => (
          <p key={paragraph.slice(0, 28)} className="text-sm leading-relaxed text-[var(--foreground)]">
            {paragraph}
          </p>
        ))}
      </div>

      <section className="card-panel mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          Кому может быть интересен этот калькулятор
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-[var(--foreground)]">
          {info.audienceRu.map((item) => (
            <li key={item.slice(0, 28)}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={calculatorPath} className="btn-primary inline-flex w-auto">
          Перейти к калькулятору
        </Link>
      </div>
    </div>
  );
}
