/**
 * Template HTML pour l'email de résultats.
 *
 * Pas de framework (React Email, MJML…) en MVP — un template string suffit
 * et se débogue plus facilement. Compatible avec tous les clients mail
 * majeurs (table-based layout, styles inline).
 *
 * Si on a besoin de templates plus complexes plus tard, on pourra migrer
 * vers React Email sans changer la signature publique de cette fonction.
 */

export type ResultsTemplateData = {
  /** 3 premiers métiers du classement à mettre en avant. */
  topMatches: Array<{
    title: string;
    tagline: string;
    scorePercent: number;
  }>;
  /** Lien direct vers la page de résultats avec le sessionId pré-rempli. */
  resultsUrl: string;
  /** Total de métiers correspondants (pour teaser le rapport complet). */
  totalMatches: number;
};

/**
 * Échappe les caractères HTML dangereux dans les chaînes d'utilisateur.
 * Critique sur `tagline` et `title` qui viennent de l'API ROME (en théorie
 * sûres, mais on ne fait pas confiance aveuglément à une source externe).
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildResultsEmail(data: ResultsTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const { topMatches, resultsUrl, totalMatches } = data;

  const matchesHtml = topMatches
    .map(
      (m, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 16px 0; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 4px 0; color: #6366f1; font-size: 13px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            #${i + 1} · ${m.scorePercent}% d'adéquation
          </p>
          <h3 style="margin: 0 0 6px 0; color: #0f172a; font-size: 18px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            ${escapeHtml(m.title)}
          </h3>
          <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            ${escapeHtml(m.tagline)}
          </p>
        </td>
      </tr>
    </table>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tes résultats FindYourJob</title>
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
                FindYourJob
              </h1>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 32px; background: #ffffff; border-radius: 16px 16px 0 0; border: 1px solid #e2e8f0; border-bottom: none;">
              <h2 style="margin: 0 0 8px 0; color: #0f172a; font-size: 22px; font-weight: 600;">
                Voici tes pistes métiers 🎯
              </h2>
              <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">
                On a analysé tes réponses. Voici les 3 métiers qui collent le mieux à ton profil :
              </p>
            </td>
          </tr>

          <!-- Top 3 -->
          <tr>
            <td style="padding: 24px 32px 32px 32px; background: #ffffff; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              ${matchesHtml}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 32px 32px 32px; background: #ffffff; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; text-align: center;">
              <a href="${resultsUrl}" style="display: inline-block; padding: 14px 28px; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 999px;">
                Voir tous mes résultats →
              </a>
              ${
                totalMatches > 3
                  ? `<p style="margin: 16px 0 0 0; color: #64748b; font-size: 13px;">${totalMatches - 3} autres métiers t'attendent dans ton rapport complet.</p>`
                  : ''
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background: #ffffff; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 12px; line-height: 1.5; text-align: center;">
                Tu reçois cet email car tu as complété le questionnaire FindYourJob.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
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

  // Version texte pour les clients qui ne rendent pas le HTML
  // (et pour améliorer la délivrabilité — Gmail aime les multipart/alternative)
  const textMatches = topMatches
    .map((m, i) => `${i + 1}. ${m.title} — ${m.scorePercent}% d'adéquation\n   ${m.tagline}`)
    .join('\n\n');

  const text = `Voici tes pistes métiers FindYourJob

On a analysé tes réponses. Voici les 3 métiers qui collent le mieux à ton profil :

${textMatches}

Voir tous mes résultats : ${resultsUrl}
${totalMatches > 3 ? `\n${totalMatches - 3} autres métiers t'attendent dans ton rapport complet.\n` : ''}
---
Tu reçois cet email car tu as complété le questionnaire FindYourJob.
Une question ? Réponds simplement à cet email.`;

  return {
    subject: `Tes ${topMatches.length} métiers correspondants 🎯`,
    html,
    text,
  };
}
