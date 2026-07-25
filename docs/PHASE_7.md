# Phase 7 — Community finance and giving

Phase 7 adds public giving, personal finance tools, and a basic USSD entry point.

## Delivered

- Public Sadaka campaign discovery and donation recording, with campaign progress and Sharia-board endorsement badges.
- Donation fee disclosure: the default is `donation_addon`, so the full gift reaches the stated cause and the platform fee is shown separately.
- Zakat estimator using an approximate KES nisab and a 2.5% rate.
- A separate platform-support tip flow; it is explicitly not Sadaka.
- Finance hub with Qard Hassan requests/repayments, Tawarruq applications, savings-goal management, and circle welfare balances.
- Circle member CSV export for circle officers.
- Africa's Talking-style USSD menu stub for balance, circles, and payment navigation. It persists sessions with the service role when configured, otherwise falls back to in-memory responses.

## Fee policy decision

`donation_addon` is the default pending final Sharia board approval of the platform fee policy. The campaign UI explains this clearly: the donor's stated gift is credited in full to the cause and any percentage fee is charged on top.
