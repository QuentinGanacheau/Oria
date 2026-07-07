import LegalLayout from "../components/legal-layout";

export const metadata = {
  title: "Politique de confidentialité — Oryam",
};

export default function Confidentialite() {
  return (
    <LegalLayout title="Politique de confidentialité" lastUpdated="03/07/2026">
      <p>
        La présente politique décrit comment <strong>Qgstudio</strong>, éditeur
        du site Oryam (ci-après &laquo;&nbsp;nous&nbsp;&raquo;), collecte,
        utilise et protège vos données personnelles, conformément au Règlement
        Général sur la Protection des Données (RGPD — UE 2016/679) et à la loi
        Informatique et Libertés.
      </p>

      <h2>1. Responsable du traitement</h2>
      <ul>
        <li>
          <strong>Nom / Raison sociale :</strong> Qgstudio
        </li>
        <li>
          <strong>Adresse :</strong> 50 rue des vignes, 44115, Haute-Goulaine
        </li>
        <li>
          <strong>Email :</strong>{" "}
          <a href="mailto:qgstudio.pro@gmail.com">qgstudio.pro@gmail.com</a>
        </li>
      </ul>

      <h2>2. Données collectées</h2>

      <h3>2.1 Données de questionnaire</h3>
      <p>
        Lors du questionnaire, vos réponses (choix d&apos;options et textes
        libres) sont transmises à notre serveur pour calculer votre classement.
        Ces données sont associées à un identifiant de session anonyme (aucun
        compte, aucun email requis).
      </p>

      <h3>2.2 Données de paiement</h3>
      <p>
        Si vous achetez le rapport complet, la transaction est entièrement gérée
        par <strong>Stripe</strong>. Nous n&apos;avons pas accès à vos données
        bancaires. Stripe peut collecter votre adresse email à des fins de
        confirmation de paiement, selon sa propre politique de confidentialité
        disponible sur{" "}
        <a
          href="https://stripe.com/fr/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          stripe.com/fr/privacy
        </a>
        .
      </p>

      <h3>2.3 Stockage local (navigateur)</h3>
      <p>
        Les résultats de votre questionnaire et l&apos;état de déverrouillage du
        rapport sont stockés dans le <em>sessionStorage</em> et le{" "}
        <em>localStorage</em> de votre navigateur. Ces données restent sur votre
        appareil et ne sont pas transmises à des tiers.
      </p>

      <h3>2.4 Données techniques</h3>
      <p>
        Comme tout serveur web, le nôtre peut enregistrer des données techniques
        lors de vos requêtes (adresse IP, horodatage, chemin consulté). Ces
        données sont utilisées uniquement à des fins de sécurité et de débogage,
        et ne sont pas croisées avec votre identité.
      </p>

      <h2>3. Finalités et bases légales du traitement</h2>
      <table>
        <thead>
          <tr>
            <th>Finalité</th>
            <th>Base légale</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Calcul et affichage du classement de métiers</td>
            <td>Exécution du service (intérêt légitime)</td>
          </tr>
          <tr>
            <td>Traitement du paiement</td>
            <td>Exécution du contrat</td>
          </tr>
          <tr>
            <td>Génération des fiches personnalisées par IA</td>
            <td>Exécution du service (intérêt légitime)</td>
          </tr>
          <tr>
            <td>Sécurité et débogage technique</td>
            <td>Intérêt légitime</td>
          </tr>
        </tbody>
      </table>

      <h2>4. Durée de conservation</h2>
      <ul>
        <li>
          <strong>Données de session et résultats :</strong> conservées en base
          de données pendant <strong>30 jours</strong> (rapport gratuit) ou{" "}
          <strong>1 an</strong> (rapport payant) après la dernière activité, puis
          supprimées automatiquement.
        </li>
        <li>
          <strong>Données de paiement :</strong> conservées par Stripe selon
          leurs propres règles (obligations comptables et légales).
        </li>
        <li>
          <strong>Logs techniques :</strong> conservés{" "}
          <strong>30 jours</strong> glissants.
        </li>
      </ul>

      <h2>5. Sous-traitants et transferts de données</h2>
      <p>Nous faisons appel aux sous-traitants suivants :</p>
      <ul>
        <li>
          <strong>Stripe</strong> (paiement) — données traitées aux États-Unis,
          couvertes par les clauses contractuelles types de la Commission
          européenne.
        </li>
        <li>
          <strong>Vercel Inc.</strong> (hébergement du site) — données traitées
          aux États-Unis, couvertes par les clauses contractuelles types de la
          Commission européenne.
        </li>
        <li>
          <strong>Railway Corporation</strong> (hébergement applicatif et base
          de données) — données traitées aux États-Unis, couvertes par les
          clauses contractuelles types de la Commission européenne.
        </li>
        <li>
          <strong>Mistral AI</strong> (génération de contenu par IA) — société
          française, données traitées au sein de l&apos;Union européenne. Selon
          la disponibilité des services, nous pouvons également recourir à{" "}
          <strong>Google</strong> (Gemini) ou <strong>Anthropic</strong>{" "}
          (Claude), dont les traitements ont lieu aux États-Unis et sont
          couverts par les clauses contractuelles types de la Commission
          européenne. Vos réponses au questionnaire sont transmises pour générer
          les analyses personnalisées ; aucune information directement
          identifiante n&apos;est incluse dans ces appels.
        </li>
      </ul>
      <p>
        Aucune donnée n&apos;est vendue ni cédée à des tiers à des fins
        commerciales.
      </p>

      <h2>6. Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez des droits suivants sur vos données
        personnelles :
      </p>
      <ul>
        <li>
          <strong>Droit d&apos;accès</strong> (Art. 15) : obtenir une copie des
          données vous concernant.
        </li>
        <li>
          <strong>Droit de rectification</strong> (Art. 16) : corriger des
          données inexactes.
        </li>
        <li>
          <strong>Droit à l&apos;effacement</strong> (Art. 17) : demander la
          suppression de vos données.
        </li>
        <li>
          <strong>Droit à la portabilité</strong> (Art. 20) : recevoir vos
          données dans un format structuré.
        </li>
        <li>
          <strong>Droit d&apos;opposition</strong> (Art. 21) : vous opposer à un
          traitement fondé sur l&apos;intérêt légitime.
        </li>
      </ul>
      <p>
        Pour exercer vos droits, contactez-nous à :{" "}
        <a href="mailto:qgstudio.pro@gmail.com">
          <strong>qgstudio.pro@gmail.com</strong>
        </a>
        .
      </p>
      <p>
        Vous pouvez également introduire une réclamation auprès de la{" "}
        <strong>CNIL</strong> :{" "}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
          www.cnil.fr
        </a>
        .
      </p>

      <h2>7. Cookies et stockage local</h2>
      <p>
        Ce site n&apos;utilise pas de cookies de traçage ou publicitaires. Le
        stockage local du navigateur (<em>localStorage</em>,{" "}
        <em>sessionStorage</em>) est utilisé uniquement pour le bon
        fonctionnement du service (conservation des résultats entre les pages,
        état du déverrouillage). Vous pouvez les supprimer à tout moment depuis
        les paramètres de votre navigateur.
      </p>

      <h2>8. Sécurité</h2>
      <p>
        Nous mettons en œuvre les mesures techniques et organisationnelles
        appropriées pour protéger vos données contre tout accès non autorisé,
        altération, divulgation ou destruction. Les communications entre votre
        navigateur et notre serveur sont chiffrées via HTTPS.
      </p>

      <h2>9. Modification de cette politique</h2>
      <p>
        Nous nous réservons le droit de modifier cette politique à tout moment.
        La date de &laquo;&nbsp;Dernière mise à jour&nbsp;&raquo; en haut de
        cette page indique la version en vigueur. En cas de modification
        substantielle, nous en informerons les utilisateurs concernés.
      </p>
    </LegalLayout>
  );
}
