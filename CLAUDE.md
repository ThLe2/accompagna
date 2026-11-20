# Accompagna — instructions pour Claude

Ce fichier est lu au début de chaque session de travail sur ce dépôt.
Il décrit le projet, la base réelle, les règles à respecter et les pièges déjà
rencontrés. **Le dépôt est public : n'écrivez ici ni secret, ni donnée de
stagiaire, ni information nominative.**

Dernière mise à jour : 20/11/2026.

---

## 1. Le projet en bref

Accompagna est un LMS de **distanciel accompagné** (DA) : des parcours en ligne
suivis par des stagiaires en formation professionnelle, à heure fixe, avec
capsules vidéo, documents, exercices d'entraînement, QCM et cas pratiques.
Il remplace une plateforme du marché.

- **Front** : pages HTML/JS sans framework ni build, publiées par GitHub Pages
  (`https://thle2.github.io/accompagna/`).
- **Back** : Supabase (PostgreSQL + Auth + PostgREST), projet « Projet
  Accompagna ». Toute la logique métier vit **en base** (fonctions SQL,
  RLS, triggers) ; les pages n'en sont que l'affichage.
- **Contenus pédagogiques** (capsules, mémos, exercices HTML) : un dépôt
  GitHub par ressource, servi par GitHub Pages.

Accompagna est la version personnelle d'un LMS jumeau (« LMS TMK », dépôt
`espace-formation`, autre projet Supabase). Les deux ont le même socle ;
Accompagna a en plus l'**Atelier de questions** et une charte **bleue**
(le LMS TMK est en prune).

### Fichiers du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | Connexion, puis aiguillage stagiaire / personnel |
| `portail.html` | Face stagiaire : séances, fil des étapes, lecteur vidéo, QCM |
| `admin.html` | Face personnel : groupes, séances, résultats, copies, modules, Atelier de questions, assistant du cours |
| `config.js` | URL du projet et **clé publique** (anon / publishable) uniquement |
| `demo.js` | Données fictives pour `index.html?demo` |
| `vendor/supabase.js` | Client Supabase embarqué (pas de CDN : souvent filtré chez les clients) |

Sources locales du propriétaire : `OneDrive\Accompagna` (profil Windows
variable selon le poste : **ne jamais écrire de chemin `C:\Users\…` en dur**).

---

## 2. Règles d'or

1. **Ne jamais écrire de SQL contre un schéma supposé.** Avant tout SQL,
   relever le schéma réel (requêtes d'inventaire en §8). Si une information
   manque, la demander plutôt que la deviner.
2. **Vérifier qu'une fonction n'existe pas déjà** avant d'en écrire une
   (`pg_proc`, §8). L'essentiel du LMS est déjà construit ; réécrire de zéro
   une fonction existante est l'erreur la plus fréquente.
3. **RLS et privilèges sont deux mécanismes distincts** : une politique
   permissive ne vaut rien sans `GRANT`, et l'inverse. Toujours regarder les
   deux avant de conclure qu'une donnée est exposée ou protégée.
4. **Le corrigé ne quitte jamais `prive`.** Aucun privilège à `anon` ni
   `authenticated` sur ce schéma, qui n'est **jamais exposé** par l'API.
5. **Aucune clé secrète dans le dépôt** (`service_role`, `sb_secret_…`).
6. **Parité avec le LMS TMK** : toute évolution du socle commun faite sur l'un
   doit être reportée sur l'autre (le LMS TMK n'a pas l'atelier : y adapter,
   pas copier).
7. **Annoncer tout écart au fil de l'eau** : si le schéma réel contredit ce
   fichier ou une demande, le dire immédiatement, sans attendre.
8. **Avant d'écraser un fichier du dépôt**, vérifier qu'il n'a pas changé
   depuis sa lecture (`git fetch`, comparaison). Un commit par sujet, message
   en français.

---

## 3. Schéma réel (relevé en base le 19/11/2026)

Identifiants : **`int4` identity** (pas d'uuid), sauf les comptes
(`auth.users`, uuid). Fuseau métier : `lms.tz()`.

### `contenu` — ce que l'on enseigne (sans date, réutilisable)

| Table | Colonnes utiles |
|---|---|
| `das` | `id`, `code` unique, `libelle`, `version`, `actif`, `assistant` (assistant du cours activé) |
| `sequences` | `id`, `ref` unique, `titre`, `intro`, `actif` |
| `da_composition` | PK (`da_id`, `position`) ; **exactement un** de `sequence_id` / `etape_id` |
| `etapes` | `id`, `da_id` (**toujours nul**), `ref`, `ordre`, `type`, `titre`, `bloquante`, `regle` jsonb, `media_url`, `duree_s`, `sequence_id`, `evalue`, `seuil_pct` |
| `questions` | `id`, `etape_id`, `ref`, `ordre`, `type`, `enonce`, `propositions` jsonb, `points`, `theme`, `groupe` (= atelier), `consigne` |

- `etapes.type` (enum `type_etape`) : `video | lecture | document | exercice | qcm | cas_pratique`.
  Il n'y a pas de type « exemple » : mémos et exemples sont chargés en `lecture`.
- Une étape `video` exige `duree_s`.
- Le DA d'une étape se trouve **uniquement par `da_composition`** (directement
  ou via sa séquence). `etapes.ordre` se compte **dans la séquence**.
- Conséquence : `UNIQUE (da_id, ref)` ne contraint rien (`da_id` nul) et
  `ON CONFLICT` est inutilisable. Un chargeur se rejoue **par purge du
  périmètre sur le préfixe de `ref`**, en une transaction, avec un bloc de
  vérification final qui lève une exception si les comptes ne tombent pas.
- Convention de code : DA `<theme>-<qualificatif>` (`assurance-emprunteur`,
  `sante-fondamentaux`) — jamais de numéro de journée, qui appartient à la
  séance. Refs : `<da>-m<N>-<type>` puis `-q<NN>` pour les questions.
- `etapes.regle` : vidéo `{"couverture_min":0.95,"tolerance_saut_s":5}` ;
  qcm / cas_pratique `{"essais_max":1,"restituer_corrige":true|false}` ;
  lecture `{}`.
- NOT NULL à connaître : `questions.propositions` (défaut `[]`, y compris pour
  une question ouverte), `questions.points` (> 0), `etapes.regle`,
  `etapes.bloquante`, `etapes.evalue`.

### `prive` — jamais exposé

- `corriges` : `question_id`, `attendu` jsonb, `explication`, `partiel`,
  `formule`, `tolerance`, `parametres`, `source`.
- Formes de `attendu` : `unique` → `{"index": 2}` ; `multiple` →
  `{"index": [0,1,3]}` ; `numerique` → `{"valeur": …}` (avec `tolerance`) ;
  `ouverte` → `{"correction":"formateur"}`, `{"texte":…}`, `{"elements":…}`,
  `{"dictee":…}` selon le mode de correction.
- **`attendu.index` compte à partir de 0.** Un classeur qui note le rang
  (1 à 4) doit être converti : l'erreur serait silencieuse.
- `mots_questions` : cache des mots-clés de chaque énoncé, tenu à jour par
  trigger (sert à la règle de non-reprise, §5).
- Fonctions de correction et de calcul : `evaluer_formule`, `attendu_numerique`,
  `corriger_*`, `mots_normalises`, `chiffres_en_dur`, `renvois`…

### `lms` — qui, quand

`stagiaires`, `formateurs` (rôle `formateur | gestionnaire | admin`),
`groupes` (`code_analytique` unique), `inscriptions` (**contrainte d'exclusion :
jamais deux groupes en même temps**), `sessions` (`heure_debut`, `heure_fin`,
`heure_cloture`), `sessions_groupes`, `sessions_stagiaires`, `connexions`
(la présence), `decisions_acces` (exclusion / réintégration, motif obligatoire),
`progressions`, `roles_production` (auteur / pédagogique / direction).

### `eval` — les copies

`tentatives` (réponses, `detail` figé, `parametres_figes`, `date_reference`),
`annotations`, `recorrections`, et les vues `v_copie`, `v_export_financeur`,
`v_resultats`, `v_bilan_theme`, `v_questions_suspectes`, `v_synthese_groupe_da`…

- **Un seul essai par étape** (`UNIQUE (session_id, stagiaire_id, etape_id)`)
  et une tentative soumise **ne se réécrit pas** (trigger). C'est voulu.
- `eval.soumettre` corrige contre `prive.corriges` **au moment de la
  soumission** et fige la copie complète (énoncé, réponse, attendu). Une copie
  reste donc vérifiable même si la question est modifiée ensuite.
- La traçabilité exigée par les financeurs (réponses détaillées, éléments de
  notation) est portée par `v_export_financeur`.

### `atelier` — rédaction collaborative des questions (Accompagna seulement)

`questions` (brouillons, avec `attendu`, `statut`, `origine`, `question_id`
une fois publiée), `historique`. Circuit : brouillon → à valider (pédagogie)
→ à signer (direction) → signée → publiée. `atelier.controle(q)` doit renvoyer
`OK` pour transmettre, valider ou publier.

### `ia` — assistant du cours

`reglages`, `da_parametres`, `extraits` (le cours découpé, sert de base aux
réponses), `echanges`, `transmissions`. Plafond de coût par module.

### `public` — paramètres réglementaires datés

`parametres_*` (épargne, fiscaux, santé, prévoyance, TNS, parcours, actualité),
`pass_annuel`, `smic_horaire_historique`, `valeurs_articles`, `veille_*`.
Lecture publique, écriture réservée au personnel. Les questions y renvoient
par `[[clé]]` ou par `formule` au lieu d'écrire des chiffres en dur.

### Exposition par l'API

Schémas exposés : `contenu`, `lms`, `eval` (et ceux qu'exigent les pages).
**Jamais `prive`.** Écriture : uniquement par fonctions `security definer`
qui vérifient `lms.est_personnel()` / `lms.est_gestionnaire()` /
`lms.a_role_production(…)`.

---

## 4. Règles métier

- Un DA se joue **08h30 → 16h30**, clôture à **18h30** (marge pour les plus
  lents). Une tentative commencée reste soumissible après la clôture.
- La présence, c'est la **connexion à la séance ouverte** (pas de code).
- **Le retard ne bloque jamais automatiquement** : c'est la gestionnaire qui
  exclut (pour la séance du jour seulement) ou réintègre, avec un motif.
- Séance sur plusieurs jours = fenêtre continue, accès libre, sans contrôle de
  présence.
- Une étape bloquante doit être validée pour ouvrir la suivante ; une vidéo se
  valide au visionnage réel (couverture vérifiée **côté serveur**).
- Le distanciel se suit depuis chez soi ou depuis les locaux de l'organisme,
  pas depuis le réseau du client (YouTube y est souvent bloqué : **jamais
  d'iframe YouTube**, toujours un lecteur HTML5 sur `.mp4` auto-hébergé).

---

## 5. Qualité des questions (contrôles en place)

### Règle de non-reprise — interdite, vérifiée en base

**Une question de QCM ne reprend pas l'énoncé d'un exercice d'entraînement du
même DA, et inversement.** Seuil : 85 % de mots significatifs communs, pour un
énoncé d'au moins 5 mots significatifs. Le QCM porte sur les mêmes notions,
mais formulées autrement (mise en situation, autres chiffres, autre angle).

Appliquée à trois niveaux :
1. `atelier.controle(q)` : la question n'est pas conforme ;
2. trigger différé `questions_reprise_entrainement` sur `contenu.questions` :
   insertion ou modification refusée à la validation de la transaction
   (couvre SQL, console, atelier) ;
3. `lms.atelier_controle_etape` : alerte « interdit ».

### Contrôle d'ensemble d'une étape

`lms.atelier_controle_etape(etape_id)` et `lms.atelier_controle_da(da_id)`
(lecture seule, personnel). Ils portent sur l'étape **telle qu'elle sera après
publication** (questions en ligne + brouillons de l'atelier) :

| Contrôle | Niveau |
|---|---|
| Cocher toujours la même position atteint le seuil | alerte si l'étape est évaluée |
| Bonne réponse trop souvent à la même position (> 1/k + 20 pts) | attention |
| Bonne réponse la plus longue dans plus de la moitié des questions | attention |
| Doublons (même atelier, énoncés ≥ 85 %) | attention |
| Reprise d'un exercice d'entraînement | **alerte (interdit)** |
| Étape évaluée qui reprend une autre étape évaluée (> 30 %) | alerte |

### À vérifier sur tout lot de questions produit ou extrait

- Répartition de la bonne réponse sur les positions (viser ~25 % chacune).
- Une évaluation finale ne recopie pas les QCM des modules.
- La colonne `points` est numérique (piège : dans certains HTML, `points`
  contient la grille d'évaluation d'une question ouverte).
- Aucun chiffre réglementaire en dur : renvoi `[[clé]]` ou `formule`.

---

## 6. Conventions des contenus

- Dépôts de ressources : `parcours_module_type` en minuscules avec tiret bas
  (`assurance_emprunteur_m4_qcm`). Chaque page HTML interactive a **son propre
  `index.html`** de redirection.
- Vidéos : `.mp4` sous **25 Mo** (limite de l'interface web GitHub), démarrage
  progressif, lecture à 0,9× par défaut.
- Exercices d'entraînement : pas d'écran d'identité, pas de sortie PDF ; une
  fois un atelier validé, ses réponses sont **figées** (rejeu complet possible).
- QCM : copier-coller désactivé. Un exercice d'entraînement interactif précède
  chaque QCM.
- Textes adressés au stagiaire : **vouvoiement**.
- Énoncés de calcul : écrire « taux débiteur annuel », pas « TAEG ».
- Charte Accompagna : **nuances de bleu**. Ne pas reprendre le prune du LMS TMK.

---

## 7. Pièges déjà rencontrés

- Écrire une fonction déjà existante (`enregistrer_visionnage`, `soumettre`…) :
  toujours inventorier `pg_proc` d'abord.
- Conclure à une fuite du corrigé d'après `pg_policies` seul : vérifier aussi
  `information_schema.column_privileges` et la colonne elle-même.
- Ligne d'exemple d'un classeur d'import réutilisant une `ref` réelle :
  collision au chargement. Les exemples prennent des refs fictives.
- Renommage d'une clé de paramètre : la chercher **partout** (formules,
  `parametres_cites`, explications), pas seulement là où on l'attend.
- `web_fetch` d'une page HTML supprime les `<script>` (donc les questions) :
  récupérer les sources brutes par `raw.githubusercontent.com`.
- Fonction `security definer` sans `set search_path` : toujours le fixer.
- Fonction qui crée une table temporaire : elle doit être `volatile`.
- Requête d'inventaire des enums : `group by n.nspname, t.typname`.
- Une même normalisation de texte recalculée pour chaque paire de questions
  rend un contrôle lent (37 s pour un DA) : s'appuyer sur `prive.mots_questions`.

---

## 8. Requêtes d'inventaire (à relancer avant toute évolution)

```sql
-- Colonnes
select table_schema, table_name,
       string_agg(column_name || ':' || data_type, ', ' order by ordinal_position)
from information_schema.columns
where table_schema in ('contenu','lms','eval','prive','atelier','ia')
group by 1, 2 order by 1, 2;

-- Fonctions et droits d'exécution
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args,
       p.prosecdef security_definer,
       array_to_string(array(select grantee::regrole::text from aclexplode(p.proacl)
                             where privilege_type = 'EXECUTE'), ',') execute_par
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('contenu','lms','eval','prive','atelier','ia')
order by 1, 2;

-- Contraintes
select conrelid::regclass, conname, pg_get_constraintdef(oid)
from pg_constraint
where connamespace::regnamespace::text in ('contenu','lms','eval','prive','atelier')
order by 1, 2;

-- Politiques RLS
select schemaname, tablename, policyname, cmd, roles, qual
from pg_policies order by 1, 2, 3;
```

Pour tester une fonction réservée au personnel depuis l'éditeur SQL :

```sql
select set_config('request.jwt.claims',
  json_build_object('sub', '<user_id d''un formateur actif>', 'role', 'authenticated')::text, true);
```

Pour tester un garde-fou sans rien enregistrer : faire la modification dans un
bloc `do`, `set constraints all immediate;`, puis `raise exception` pour
annuler dans tous les cas.
