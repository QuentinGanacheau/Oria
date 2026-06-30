/**
 * Template HTML pour l'email de confirmation de paiement.
 *
 * Envoyé après un checkout Stripe réussi. Contient :
 *  - Une confirmation visuelle (icône check, montant)
 *  - Un rappel de ce qui est débloqué
 *  - Un lien direct vers les résultats complets
 *  - Les mentions légales liées au paiement (TVA, droit de rétractation)
 *
 * Comme `results.template.ts`, on utilise du HTML statique avec styles inline
 * pour la compatibilité maximale (Gmail, Outlook, Apple Mail…).
 */

export type PaymentTemplateData = {
  /** Lien direct vers la page /resultats. */
  resultsUrl: string;
  /** Total payé en centimes (ex: 990 pour 9,90€). */
  amountTotalCents: number;
  /** Devise ISO 4217 (ex: "eur"). */
  currency: string;
  /** Total de métiers maintenant accessibles (le user a débloqué tout le rapport). */
  totalMatches: number;
};

/**
 * Formate un montant Stripe (en centimes) en string localisé EUR.
 * Stripe renvoie toujours les montants en plus petite unité de la devise.
 */
function formatAmount(cents: number, currency: string): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

export function buildPaymentEmail(data: PaymentTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const { resultsUrl, amountTotalCents, currency, totalMatches } = data;
  const formattedAmount = formatAmount(amountTotalCents, currency);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paiement confirmé — Oryam</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="padding: 0 0 24px 0; text-align: center;">
              <h1 style="margin: 0; color: #4f46e5; font-size: 24px; font-weight: 700;">
                Oryam
              </h1>
            </td>
          </tr>

          <!-- Hero confirmation -->
          <tr>
            <td style="padding: 40px 32px 32px 32px; background: #ffffff; border-radius: 16px 16px 0 0; border: 1px solid #e2e8f0; border-bottom: none; text-align: center;">
              <div style="display: inline-block; width: 64px; height: 64px; line-height: 64px; background-color: #d1fae5; border-radius: 50%; font-size: 32px;">
                ✓
              </div>
              <h2 style="margin: 16px 0 8px 0; color: #0f172a; font-size: 22px; font-weight: 600;">
                Paiement confirmé
              </h2>
              <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">
                Merci ! Ton rapport complet est débloqué.
              </p>
            </td>
          </tr>

          <!-- Résumé paiement -->
          <tr>
            <td style="padding: 8px 32px 24px 32px; background: #ffffff; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 12px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #64748b; font-size: 13px;">Montant payé</p>
                    <p style="margin: 2px 0 0 0; color: #0f172a; font-size: 20px; font-weight: 600;">${formattedAmount}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Ce qui est débloqué -->
          <tr>
            <td style="padding: 0 32px 24px 32px; background: #ffffff; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px; font-weight: 600;">
                Ce que tu débloques :
              </h3>
              <ul style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 14px; line-height: 1.8;">
                <li>L&apos;intégralité du classement (${totalMatches} métiers)</li>
                <li>L&apos;explication personnalisée pour chaque métier</li>
                <li>L&apos;accès permanent depuis cet appareil</li>
              </ul>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 32px 32px 32px; background: #ffffff; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; text-align: center;">
              <a href="${resultsUrl}" style="display: inline-block; padding: 14px 28px; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 999px;">
                Accéder à mes résultats →
              </a>
            </td>
          </tr>

          <!-- Footer légal -->
          <tr>
            <td style="padding: 24px 32px; background: #ffffff; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 11px; line-height: 1.6; text-align: center;">
                Cette transaction apparaîtra sur ton relevé sous le nom du commerçant.
                <br>Tu peux conserver cet email comme reçu.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px; text-align: center;">
                Une question ? Réponds simplement à cet email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Paiement confirmé — Oryam

Merci ! Ton rapport complet est débloqué.

Montant payé : ${formattedAmount}

Ce que tu débloques :
- L'intégralité du classement (${totalMatches} métiers)
- L'explication personnalisée pour chaque métier
- L'accès permanent depuis cet appareil

Accéder à tes résultats : ${resultsUrl}

---
Tu peux conserver cet email comme reçu.
Une question ? Réponds simplement à cet email.`;

  return {
    subject: 'Paiement confirmé — Ton rapport est débloqué ✓',
    html,
    text,
  };
}
