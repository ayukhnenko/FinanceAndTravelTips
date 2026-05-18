export type CalculatorInfoKey =
  | "early_repay"
  | "bonds_cover"
  | "card_benefit"
  | "mortgage_sale"
  | "rent_vs_buy"
  | "compound"
  | "discounting"
  | "loan";

export type CalculatorInfoContent = {
  shortRu: string;
  shortEn: string;
  fullRu: string[];
  fullEn: string[];
  audienceRu: string[];
  audienceEn: string[];
};

export const calculatorInfo: Record<CalculatorInfoKey, CalculatorInfoContent> = {
  early_repay: {
    shortRu:
      "Сравнивает ставку по кредиту с доходностью вклада и ключевой ставкой — стоит ли гасить досрочно.",
    shortEn:
      "Compares your loan rate with deposit yield and the key rate to see if early repayment pays off.",
    fullRu: [
      "Калькулятор отвечает на вопрос: выгоднее направить свободные деньги на досрочное погашение кредита или оставить их на вкладе (или в другом инструменте с известной доходностью).",
      "Учитываются ставка по кредиту, ставка вклада, ключевая ставка ЦБ как ориентир и надбавка +0,5 п.п. для ипотеки (страховка). В результате — рекомендация и наглядное сравнение эффективных ставок.",
    ],
    fullEn: [
      "This tool answers whether free cash is better used for early loan repayment or kept on deposit (or another instrument with a known yield).",
      "It uses the loan rate, deposit rate, the Bank of Russia key rate as a benchmark, and adds +0.5 p.p. for mortgages (insurance). You get a recommendation and a clear comparison of effective rates.",
    ],
    audienceRu: [
      "Заёмщикам с ипотекой или потребительским кредитом, которые думают о частичном досрочном погашении.",
      "Тем, кто сравнивает «закрыть кредит» с размещением денег на вкладе под текущую ставку.",
    ],
    audienceEn: [
      "Borrowers with a mortgage or consumer loan considering partial early repayment.",
      "Anyone weighing “pay down the loan” against keeping money on deposit at current rates.",
    ],
  },
  bonds_cover: {
    shortRu:
      "Считает, на какую сумму купить облигации или положить на вклад, чтобы доход покрывал платежи по кредиту.",
    shortEn:
      "Estimates how much to invest in bonds or on deposit so the income covers your loan payments.",
    fullRu: [
      "Помогает оценить, какой объём вложений в облигации с полугодовыми купонами нужен, чтобы купонный доход перекрывал ежемесячный платёж по кредиту до конца срока.",
      "Можно задать остаток долга, срок, платёж и ориентир по доходности (ключевая ставка). Показывается требуемый номинал и упрощённая логика расчёта.",
    ],
    fullEn: [
      "Helps estimate how much to invest in bonds paying semiannual coupons so coupon income covers your monthly loan payment until the loan ends.",
      "You can enter remaining debt, term, payment, and a yield benchmark (key rate). The result shows required face value and the logic behind the estimate.",
    ],
    audienceRu: [
      "Инвесторам, которые хотят «подложить» под кредит поток купонов, а не гасить его единовременно.",
      "Тем, кто планирует стратегию: кредит + облигации с известной купонной доходностью.",
    ],
    audienceEn: [
      "Investors who want coupon cash flow to sit alongside a loan instead of repaying it in one go.",
      "Anyone planning a “loan + bonds with known coupon yield” strategy.",
    ],
  },
  card_benefit: {
    shortRu:
      "Оценивает выгоду от трат по кредитке в льготный период при размещении своих денег на вкладе.",
    shortEn:
      "Estimates benefit from card spending during the grace period while your cash stays on deposit.",
    fullRu: [
      "Считает, сколько можно заработать на вкладе, если ежемесячные расходы оплачивать кредитной картой с льготным периодом, а свои деньги держать на депозите до погашения задолженности по карте.",
      "Учитываются сумма трат, длина льготного периода (с поправкой на типичные сроки зачисления) и ставка вклада.",
    ],
    fullEn: [
      "Estimates deposit income when you pay monthly expenses with a credit card during the grace period while keeping your own cash on deposit until the card balance is due.",
      "Uses spending amount, grace period length (adjusted for typical posting delays), and deposit rate.",
    ],
    audienceRu: [
      "Пользователям кредитных карт с длинным беспроцентным периодом и дисциплиной полного погашения.",
      "Тем, кто хочет понять, насколько «кэшбэк в виде процентов по вкладу» окупает схему трат через карту.",
    ],
    audienceEn: [
      "Credit card users with a long interest-free period who pay the balance in full each cycle.",
      "Anyone curious how much “deposit yield instead of cashback” the card-and-deposit scheme is worth.",
    ],
  },
  mortgage_sale: {
    shortRu:
      "Сравнивает, что принесёт инвестору больший доход: продать квартиру и вложить выручку или оставить и сдавать.",
    shortEn:
      "Compares which brings a greater return: sell the home and invest proceeds, or keep it and rent it out.",
    fullRu: [
      "Считает итоговый капитал к концу оставшегося срока ипотеки в двух сценариях: продажа (выручка после погашения долга на вкладе под ключевую ставку) и удержание (квартира + накопления с разницы «аренда − ипотека» при сдаче).",
      "Показывает, какой вариант выгоднее именно с точки зрения дохода инвестора, и при каком росте цены квартиры удержание догоняет продажу.",
    ],
    fullEn: [
      "Projects end-of-horizon wealth for two paths: sell (net proceeds on deposit at the key rate) versus hold (property plus compounded rent-minus-mortgage cash flow from letting).",
      "Shows which option delivers a higher investor return and what home price growth would make holding catch up to selling.",
    ],
    audienceRu: [
      "Владельцам квартиры в ипотеке, которые выбирают между продажей с вложением денег и сдачей в аренду.",
      "Инвесторам, для которых главный критерий — максимальный доход к концу горизонта, а не только «жить в своей» или «снимать».",
    ],
    audienceEn: [
      "Homeowners with a mortgage choosing between selling and investing cash versus keeping the property as a rental.",
      "Investors whose main criterion is maximum return by the horizon, not only lifestyle factors.",
    ],
  },
  rent_vs_buy: {
    shortRu:
      "Помогает понять, что выгоднее человеку, который сейчас живёт в аренде и думает о покупке квартиры.",
    shortEn:
      "Helps decide what is better for someone renting now and considering buying a home.",
    fullRu: [
      "Строит два сценария на срок ипотеки: жить в аренде и копить на вкладе (взнос + разница платежей) или купить квартиру и при необходимости откладывать разницу «аренда минус ипотека».",
      "Есть таблица и график по годам, итоговый капитал, приведённая стоимость при дисконтировании и оценка годового роста цены/аренды, при котором варианты равны.",
    ],
    fullEn: [
      "Builds two paths over the mortgage term: rent and compound on deposit (down payment + payment gap) or buy and save the “rent minus mortgage” gap when mortgage is cheaper.",
      "Includes a yearly table and chart, terminal wealth, present value with a discount rate, and the annual home/rent growth rate that makes both options equal.",
    ],
    audienceRu: [
      "Тем, кто выбирает между арендой и покупкой сопоставимого жилья в одном городе.",
      "Семьям с первоначальным взносом, которые хотят увидеть капитал к концу срока ипотеки в цифрах.",
    ],
    audienceEn: [
      "People choosing between renting and buying comparable housing in the same market.",
      "Households with a down payment who want end-of-term wealth in numbers.",
    ],
  },
  compound: {
    shortRu: "Показывает, во сколько вырастет сумма при сложном проценте и заданной капитализации.",
    shortEn: "Shows how a sum grows with compound interest at a chosen compounding frequency.",
    fullRu: [
      "Базовый калькулятор сложного процента: начальная сумма, годовая ставка, срок и период начисления (месяц, квартал, год).",
      "Полезен для быстрой оценки накоплений без учёта налогов, комиссий и нерегулярных взносов.",
    ],
    fullEn: [
      "A basic compound interest calculator: principal, annual rate, term, and compounding period (monthly, quarterly, yearly).",
      "Useful for a quick savings projection without taxes, fees, or irregular contributions.",
    ],
    audienceRu: [
      "Начинающим инвесторам и тем, кто объясняет себе эффект капитализации на простом примере.",
      "Всем, кому нужна «приблизительная цель» по сумме на горизонте N лет.",
    ],
    audienceEn: [
      "Beginner investors and anyone learning the effect of compounding on a simple example.",
      "Anyone who needs a rough target amount over N years.",
    ],
  },
  discounting: {
    shortRu:
      "Показывает, как уменьшается текущая стоимость суммы за срок t лет при ставке дисконтирования r (по умолчанию — ключевая ставка ЦБ).",
    shortEn:
      "Calculates how much a sum grows over time using a discount rate (defaults to the Bank of Russia key rate).",
    fullRu: [
      "Калькулятор показывает, какому эквиваленту в будущем будет соответствовать текущая сумма при заданной ставке дисконтирования.",
      "Введите сумму сегодня, срок t и ставку r (по умолчанию подставляется ключевая ставка ЦБ) — на выходе получите эквивалент этой суммы через t лет.",
    ],
    fullEn: [
      "This tool shows the future equivalent of a current amount using a chosen discount rate.",
      "Enter today’s amount, term t, and rate r (defaults to the Bank of Russia key rate) to get the equivalent value after t years.",
    ],
    audienceRu: [
      "Тем, кто сравнивает финансовые решения во времени и хочет увидеть будущую стоимость текущей суммы.",
      "Пользователям, которым нужен простой ориентир без сложных моделей и дополнительных допущений.",
    ],
    audienceEn: [
      "Anyone comparing financial decisions across time and wanting the future value of a current amount.",
      "Users who need a simple benchmark without complex models or extra assumptions.",
    ],
  },
  loan: {
    shortRu:
      "График платежей по кредиту: аннуитет или дифференцированный, проценты, тело долга и переплата.",
    shortEn:
      "Loan payment schedule: annuity or differentiated, interest, principal, and total interest.",
    fullRu: [
      "Строит полный график погашения: ежемесячный платёж, доля процентов и основного долга, остаток, накопленные проценты и основной долг.",
      "Поддерживаются аннуитетные и дифференцированные платежи, наглядный график и таблица — для планирования бюджета и сравнения схем.",
    ],
    fullEn: [
      "Builds a full repayment schedule: monthly payment, interest vs principal split, balance, cumulative interest and principal.",
      "Supports annuity and differentiated payments with a chart and table for budgeting and scheme comparison.",
    ],
    audienceRu: [
      "Будущим и действующим заёмщикам перед подписанием договора или при рефинансировании.",
      "Тем, кто хочет увидеть переплату по процентам и структуру платежа по месяцам.",
    ],
    audienceEn: [
      "Prospective and current borrowers before signing or when refinancing.",
      "Anyone who wants to see total interest and how each month’s payment is split.",
    ],
  },
};
