# Puuttuva pala

Manic Miner -henkinen tasohyppelypuzzle. Kentästä puuttuu pala: pelaaja asettaa annetut palat oikeisiin kohtiin, jotta avaimet saa kerättyä ja ovelle pääsee.

## Sivut

- `index.html`: peli. Kosketusohjaus iPadille, näppäimistö (nuolet, välilyönti, R) tietokoneella.
- `editor.html`: kenttäeditori. Piirrä kenttä, aseta palat ja niiden ratkaisupaikat, testaa ja tarkista ratkaisijalla.
  Omat kentät tallentuvat selaimeen ja näkyvät pelin Kentät-valikossa kohdassa Omat kentät.

## Rakenne

- `js/engine.js`: pelimoottori (yhteinen pelille, editorille ja ratkaisijalle)
- `js/levels.js`: pelin valmiit kentät
- `js/solver.js`, `js/solver-worker.js`: ratkaisija (selaimessa workerissa, Nodessa suoraan)
- `tools/check.js`: tarkistaa kaikki kentät: `node tools/check.js` tai `node tools/check.js 11 12`
- `tools/format_levels.py`: siistii `js/levels.js`-tiedoston muotoilun

## Kentän lisääminen peliin

1. Tee kenttä editorissa ja varmista Tarkista-napilla, että kaikki rivit ovat vihreällä.
2. Paina Teksti → Kopioi ja lisää teksti `js/levels.js`-listaan.
3. Aja `node tools/check.js`.

## Julkaisu

Render Static Site, asetukset tiedostossa `render.yaml`. Ei build-vaihetta: julkaistava kansio on repon juuri.
