# Virtuse Verdict: запуск оплаты Stripe (рабочий режим)

Состояние на 2026-10-31. Значения ключей здесь не записаны и в чат не попадают, только названия.

## Что проверено (staging, тестовый режим Stripe)

Полный отчёт за 14 € разово, цена с налогом. Все проверки прошли:
- карта с отказом;
- 3D Secure: неудача и успех;
- отмена оплаты;
- возврат: после него отчёт не открывается;
- доступ к отчёту закрывается через 30 минут после открытия.

Квитанции в тестовом режиме Stripe не отправляет.

## Решения, без которых не запускаем

1. «ano» от Раса: получено.
2. Юрист проверил условия (TOS) для платного отчёта: одобрено.
3. Бухгалтер: нужен ли Stripe Tax (`STRIPE_AUTOMATIC_TAX=1`) и счёт после оплаты (`STRIPE_INVOICE=1`). Пока оба выключены.

## Что сделать в рабочем аккаунте Stripe

- Продукт и цена 14 € (EUR, разово, tax-inclusive), записать её Price ID.
- Webhook на production Worker, события `checkout.session.completed`, `checkout.session.async_payment_succeeded` и `charge.refunded`, записать signing secret.
- Settings → Customer emails: включить «Successful payments», решить про «Refunds».
- Public details и branding: название компании, адрес, email поддержки (это видно в квитанции и на странице оплаты).

## Что внести в production Worker (сам Рас, через `wrangler secret put`)

- `STRIPE_SECRET_KEY`: рабочий ключ, лучше restricted (`rk_live_…`);
- `STRIPE_WEBHOOK_SECRET`;
- `STRIPE_PRICE_ID_VERDICT`.

Переменные production Worker в `wrangler.toml`: `VERDICT_PAYMENTS=1`, без `STRIPE_TEST_ONLY`.

## Код и деплой

- Код оплаты в main (`86e21143`, перенесён на новую модульную структуру Worker, тесты 169/169). Ветку `feat/verdict-stripe-checkout` больше не сливать, она устарела.
- Staging: сайт (gh-pages) и staging Worker развёрнуты из main, Stripe в тестовом режиме отвечает.
- В `wrangler.toml` у production Worker уже стоит `VERDICT_PAYMENTS=1`. Пока трёх секретов нет, оплата закрыта, бесплатный Verdict работает как раньше. Поэтому порядок: сначала секреты, потом деплой через Ship (или деплой, потом секреты: оплата включится в момент, когда будет внесён последний секрет).
- Деплой Worker и сайта через Ship.
- После деплоя: одна настоящая оплата на 14 € и возврат, проверка квитанции.
