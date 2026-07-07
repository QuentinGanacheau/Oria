import LegalLayout from "../components/legal-layout";

export const metadata = {
  title: "Mentions légales — Oryam",
};

export default function MentionsLegales() {
  return (
    <LegalLayout title="Mentions légales" lastUpdated="03/07/2026">
      <h2>1. Éditeur du site</h2>
      <p>
        Le site <strong>Oryam</strong> (accessible à l&apos;adresse{" "}
        <strong>https://oryam.fr/</strong>) est édité par :
      </p>
      <ul>
        <li>
          <strong>Raison sociale / Nom :</strong> Qgstudio
        </li>
        <li>
          <strong>Statut juridique :</strong> Auto-entrepreneur
        </li>
        <li>
          <strong>SIRET :</strong> 104897475
        </li>
        <li>
          <strong>Adresse :</strong> 50 rue des vignes, 44115, Haute-Goulaine
        </li>
        <li>
          <strong>Email :</strong>{" "}
          <a href="mailto:qgstudio.pro@gmail.com">qgstudio.pro@gmail.com</a>
        </li>
      </ul>

      <h2>2. Directeur de la publication</h2>
      <p>
        Le directeur de la publication est <strong>Quentin Ganacheau</strong>,
        joignable à l&apos;adresse email indiquée ci-dessus.
      </p>

      <h2>3. Hébergement</h2>
      <p>Le site (interface web) est hébergé par&nbsp;:</p>
      <ul>
        <li>
          <strong>Société :</strong> Vercel Inc.
        </li>
        <li>
          <strong>Adresse :</strong> 340 S Lemon Ave #4133, Walnut, CA 91789,
          États-Unis
        </li>
        <li>
          <strong>Site web :</strong>{" "}
          <a
            href="https://vercel.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            vercel.com
          </a>
        </li>
      </ul>
      <p>
        Les services applicatifs et la base de données (traitement des données
        du questionnaire) sont hébergés par&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Société :</strong> Railway Corporation
        </li>
        <li>
          <strong>Adresse :</strong> 80 Pine Street, 27th Floor, New York, NY
          10005, États-Unis
        </li>
        <li>
          <strong>Site web :</strong>{" "}
          <a
            href="https://railway.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            railway.com
          </a>
        </li>
      </ul>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des contenus présents sur ce site (textes, graphismes,
        logiciels, code source, images, structure) est la propriété exclusive de
        Qgstudio ou de ses partenaires, et est protégé par les lois françaises
        et internationales relatives à la propriété intellectuelle.
      </p>
      <p>
        Toute reproduction, représentation, modification ou exploitation
        partielle ou totale des contenus, sans autorisation préalable et écrite,
        est strictement interdite et constituerait une contrefaçon sanctionnée
        par les articles L.335-2 et suivants du Code de la propriété
        intellectuelle.
      </p>

      <h2>5. Limitation de responsabilité</h2>
      <p>
        Les informations présentes sur ce site sont fournies à titre indicatif
        et ne constituent pas un conseil professionnel en orientation ou en
        recrutement. Oryam ne peut garantir l&apos;exactitude,
        l&apos;exhaustivité ou l&apos;actualité des informations diffusées.
      </p>
      <p>
        L&apos;utilisation des informations et contenus disponibles sur ce site
        se fait sous la responsabilité exclusive de l&apos;utilisateur.
      </p>

      <h2>6. Cookies</h2>
      <p>
        Ce site utilise le stockage local du navigateur (<em>localStorage</em>{" "}
        et <em>sessionStorage</em>) pour mémoriser les résultats du
        questionnaire et l&apos;état du déverrouillage. Aucun cookie de traçage
        ou publicitaire n&apos;est déposé sans votre consentement. Pour plus
        d&apos;informations, consultez notre{" "}
        <a href="/confidentialite">Politique de confidentialité</a>.
      </p>

      <h2>7. Droit applicable</h2>
      <p>
        Les présentes mentions légales sont régies par le droit français. Tout
        litige relatif à l&apos;utilisation du site sera soumis à la compétence
        exclusive des tribunaux français.
      </p>
    </LegalLayout>
  );
}
