import LegalLayout from "../components/legal-layout";

export const metadata = {
  title: "Mentions légales — FindYourJob",
};

export default function MentionsLegales() {
  return (
    <LegalLayout title="Mentions légales" lastUpdated="[DATE DE MISE EN LIGNE]">

      <h2>1. Éditeur du site</h2>
      <p>
        Le site <strong>FindYourJob</strong> (accessible à l&apos;adresse{" "}
        <strong>[URL DU SITE]</strong>) est édité par :
      </p>
      <ul>
        <li><strong>Raison sociale / Nom :</strong> [NOM OU RAISON SOCIALE]</li>
        <li><strong>Statut juridique :</strong> [EX : Auto-entrepreneur / SAS / SARL]</li>
        <li><strong>SIRET :</strong> [NUMÉRO SIRET] <em>(si applicable)</em></li>
        <li><strong>Adresse :</strong> [ADRESSE COMPLÈTE]</li>
        <li><strong>Email :</strong> <a href="mailto:[EMAIL]">[EMAIL DE CONTACT]</a></li>
      </ul>

      <h2>2. Directeur de la publication</h2>
      <p>
        Le directeur de la publication est <strong>[PRÉNOM NOM]</strong>, joignable à
        l&apos;adresse email indiquée ci-dessus.
      </p>

      <h2>3. Hébergement</h2>
      <p>Ce site est hébergé par :</p>
      <ul>
        <li><strong>Société :</strong> [NOM DE L&apos;HÉBERGEUR — ex : Vercel Inc. / Fly.io]</li>
        <li><strong>Adresse :</strong> [ADRESSE DE L&apos;HÉBERGEUR]</li>
        <li><strong>Site web :</strong> <a href="[URL HÉBERGEUR]" target="_blank" rel="noopener noreferrer">[URL HÉBERGEUR]</a></li>
      </ul>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des contenus présents sur ce site (textes, graphismes, logiciels, code source,
        images, structure) est la propriété exclusive de [NOM OU RAISON SOCIALE] ou de ses
        partenaires, et est protégé par les lois françaises et internationales relatives à la
        propriété intellectuelle.
      </p>
      <p>
        Toute reproduction, représentation, modification ou exploitation partielle ou totale des
        contenus, sans autorisation préalable et écrite, est strictement interdite et constituerait
        une contrefaçon sanctionnée par les articles L.335-2 et suivants du Code de la propriété
        intellectuelle.
      </p>

      <h2>5. Limitation de responsabilité</h2>
      <p>
        Les informations présentes sur ce site sont fournies à titre indicatif et ne constituent pas
        un conseil professionnel en orientation ou en recrutement. FindYourJob ne peut garantir
        l&apos;exactitude, l&apos;exhaustivité ou l&apos;actualité des informations diffusées.
      </p>
      <p>
        L&apos;utilisation des informations et contenus disponibles sur ce site se fait sous la
        responsabilité exclusive de l&apos;utilisateur.
      </p>

      <h2>6. Cookies</h2>
      <p>
        Ce site utilise le stockage local du navigateur (<em>localStorage</em> et{" "}
        <em>sessionStorage</em>) pour mémoriser les résultats du questionnaire et l&apos;état du
        déverrouillage. Aucun cookie de traçage ou publicitaire n&apos;est déposé sans votre
        consentement. Pour plus d&apos;informations, consultez notre{" "}
        <a href="/confidentialite">Politique de confidentialité</a>.
      </p>

      <h2>7. Droit applicable</h2>
      <p>
        Les présentes mentions légales sont régies par le droit français. Tout litige relatif à
        l&apos;utilisation du site sera soumis à la compétence exclusive des tribunaux français.
      </p>

    </LegalLayout>
  );
}
