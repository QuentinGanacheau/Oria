import LegalLayout from "../components/legal-layout";

export const metadata = {
  title: "Conditions Générales de Vente — Oryam",
};

export default function CGV() {
  return (
    <LegalLayout title="Conditions Générales de Vente" lastUpdated="[DATE DE MISE EN LIGNE]">

      <h2>1. Objet</h2>
      <p>
        Les présentes Conditions Générales de Vente (CGV) régissent les ventes de services
        numériques réalisées par <strong>[NOM OU RAISON SOCIALE]</strong> (ci-après
        &laquo;&nbsp;le Vendeur&nbsp;&raquo;) via le site Oryam, à destination de tout
        utilisateur souhaitant accéder au rapport d&apos;orientation complet
        (ci-après &laquo;&nbsp;le Client&nbsp;&raquo;).
      </p>
      <p>
        Tout achat implique l&apos;acceptation pleine et entière des présentes CGV.
      </p>

      <h2>2. Description du service payant</h2>
      <p>
        Le rapport complet (&laquo;&nbsp;Oryam — Rapport complet&nbsp;&raquo;) est un
        contenu numérique personnalisé comprenant :
      </p>
      <ul>
        <li>L&apos;intégralité du classement des métiers correspondant au profil de l&apos;utilisateur ;</li>
        <li>
          Pour chaque métier : une analyse personnalisée (points forts, points de vigilance,
          prochaines étapes concrètes, journée type) générée par intelligence artificielle à partir
          des réponses au questionnaire.
        </li>
      </ul>
      <p>
        Le service est accessible immédiatement après le paiement, depuis l&apos;appareil utilisé
        lors de la commande, sans limitation de durée.
      </p>

      <h2>3. Prix</h2>
      <p>
        Le prix du rapport complet est de <strong>[PRIX] € TTC</strong>, paiement unique.
        Aucun abonnement ni frais récurrents ne sont prélevés.
      </p>
      <p>
        Les prix sont indiqués en euros toutes taxes comprises. Le Vendeur se réserve le droit de
        modifier ses prix à tout moment ; les commandes sont facturées au prix en vigueur au moment
        de la validation.
      </p>

      <h2>4. Modalités de paiement</h2>
      <p>
        Le paiement s&apos;effectue en ligne, de manière sécurisée, via la plateforme{" "}
        <strong>Stripe</strong>. Les moyens de paiement acceptés sont ceux proposés par Stripe
        (carte bancaire Visa, Mastercard, etc.).
      </p>
      <p>
        Les données bancaires du Client sont traitées exclusivement par Stripe et ne sont jamais
        stockées par Oryam. Stripe est certifié PCI-DSS niveau 1.
      </p>

      <h2>5. Droit de rétractation</h2>
      <p>
        Conformément à l&apos;article L.221-28 du Code de la consommation, <strong>le droit
        de rétractation ne peut être exercé</strong> pour les contrats de fourniture d&apos;un
        contenu numérique non fourni sur un support matériel dont l&apos;exécution a commencé
        avec l&apos;accord préalable exprès du consommateur et renoncement exprès à son droit
        de rétractation.
      </p>
      <p>
        En validant le paiement et en accédant immédiatement au rapport, le Client reconnaît
        expressément renoncer à son droit de rétractation de 14 jours.
      </p>

      <h2>6. Accès et disponibilité du service</h2>
      <p>
        L&apos;accès au rapport est déverrouillé sur l&apos;appareil utilisé lors de la commande
        (via le stockage local du navigateur). En cas de changement d&apos;appareil ou de
        suppression des données du navigateur, le Client peut contacter le support en fournissant
        la preuve de paiement.
      </p>
      <p>
        Le Vendeur s&apos;efforce d&apos;assurer la disponibilité du service 24h/24 et 7j/7, sans
        pouvoir le garantir en cas de maintenance ou de force majeure.
      </p>

      <h2>7. Réclamations et support</h2>
      <p>
        Pour toute réclamation ou demande relative à une commande, le Client peut contacter le
        service client à l&apos;adresse email :{" "}
        <a href="mailto:[EMAIL SUPPORT]"><strong>[EMAIL SUPPORT]</strong></a>.
      </p>
      <p>
        Le Vendeur s&apos;engage à répondre dans un délai de <strong>5 jours ouvrés</strong>.
      </p>
      <p>
        En cas de litige non résolu à l&apos;amiable, le Client peut recourir à la médiation de la
        consommation. Le Vendeur adhère au service de médiation :{" "}
        <strong>[NOM DU MÉDIATEUR]</strong> — <a href="[URL MÉDIATEUR]" target="_blank" rel="noopener noreferrer">[URL MÉDIATEUR]</a>.
      </p>

      <h2>8. Responsabilité</h2>
      <p>
        Les résultats fournis par Oryam sont générés par intelligence artificielle à partir
        des réponses de l&apos;utilisateur. Ils ont une vocation indicative et ne constituent pas
        un conseil professionnel en orientation, en recrutement ou en bilan de compétences.
      </p>
      <p>
        Le Vendeur ne saurait être tenu responsable des décisions prises par le Client sur la base
        des résultats obtenus.
      </p>

      <h2>9. Données personnelles</h2>
      <p>
        Les données collectées lors de la commande (adresse email via Stripe) sont traitées
        conformément à notre{" "}
        <a href="/confidentialite">Politique de confidentialité</a> et au Règlement Général sur la
        Protection des Données (RGPD).
      </p>

      <h2>10. Droit applicable et juridiction</h2>
      <p>
        Les présentes CGV sont soumises au droit français. En cas de litige, et à défaut de
        résolution amiable, les tribunaux français seront seuls compétents.
      </p>

    </LegalLayout>
  );
}
