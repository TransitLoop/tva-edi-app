# TVA EDI — Relevé des déductions

Application Tauri pour saisir, importer et exporter le **relevé des déductions TVA** (Simpl-TVA / DGI), puis générer le fichier XML `DeclarationReleveDeduction`.

## Download

| Platform | Download |
| --- | --- |
| Latest release | [Releases](https://github.com/TransitLoop/tva-edi-app/releases/latest) |
| macOS | [Assets on latest release](https://github.com/TransitLoop/tva-edi-app/releases/latest) (`.dmg` — Apple Silicon + Intel) |
| Windows | [Assets on latest release](https://github.com/TransitLoop/tva-edi-app/releases/latest) (`.exe` / `.msi`) |
| Linux | [Assets on latest release](https://github.com/TransitLoop/tva-edi-app/releases/latest) (`.AppImage` / `.deb`) |

Full history and notes: [CHANGELOG.md](./CHANGELOG.md) · [All releases](https://github.com/TransitLoop/tva-edi-app/releases)

### CI releases

GitHub Actions builds **macOS, Windows, and Linux** and uploads installers to the GitHub Release when you push a version tag:

```bash
# 1. Bump version in package.json and src-tauri/tauri.conf.json
# 2. Update CHANGELOG.md
git add -A
git commit -m "Release v0.2.0"
git tag v0.2.0
git push origin main --tags
```

Or run the **Release** workflow manually: Actions → Release → Run workflow.

## Fonctionnalités

- Saisie tableau : N° ordre, N° facture, Date facture, Fournisseur, IF, ICE, Désignation, HT, Taux TVA, TVA, TTC
- Ajout / suppression de lignes
- Menu **Modèle** : télécharger un template CSV ou Excel
- Menu **Fichier** : importer CSV, Excel ou XML
- Menu **Exporter** : CSV, Excel, ou XML EDI
- En-tête déclaration : IF, année, période, régime, mode de paiement

## Lancer

Rust/Cargo must be on your `PATH` (required by Tauri):

```bash
# if `cargo --version` fails in a new terminal:
source "$HOME/.cargo/env"
```

```bash
cd tva-edi-app
npm install
npm run tauri dev
```

## Build

Prerequisites on every platform: [Node.js](https://nodejs.org/), [Rust](https://www.rust-lang.org/tools/install), then:

```bash
cd tva-edi-app
npm install
```

Build **on the target OS** (Tauri does not cross-compile desktop installers by default). Artifacts land in `src-tauri/target/release/bundle/`.

### macOS

```bash
# .app + .dmg (Apple Silicon or Intel, depending on the machine)
npm run tauri build

# .app only
npm run tauri build -- --bundles app

# .dmg only
npm run tauri build -- --bundles dmg

# Universal binary (Intel + Apple Silicon) — requires both targets installed:
#   rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

Outputs:
- `src-tauri/target/release/bundle/macos/*.app`
- `src-tauri/target/release/bundle/dmg/*.dmg`

### Windows

Run in PowerShell or cmd on a Windows machine (Visual Studio Build Tools / C++ workload required):

```powershell
npm run tauri build

# NSIS installer (.exe) only
npm run tauri build -- --bundles nsis

# MSI installer only
npm run tauri build -- --bundles msi
```

Outputs:
- `src-tauri\target\release\bundle\nsis\*.exe`
- `src-tauri\target\release\bundle\msi\*.msi`

### Linux

```bash
# .deb + AppImage (and rpm if tooling is available)
npm run tauri build

# Debian package only
npm run tauri build -- --bundles deb

# AppImage only
npm run tauri build -- --bundles appimage

# RPM only
npm run tauri build -- --bundles rpm
```

Outputs:
- `src-tauri/target/release/bundle/deb/*.deb`
- `src-tauri/target/release/bundle/appimage/*.AppImage`
- `src-tauri/target/release/bundle/rpm/*.rpm`

System deps vary by distro; see [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux).

## Format XML

Le XML généré suit la structure des fichiers exemples du dépôt (`DeclarationReleveDeduction` / `releveDeductions` / `rd`), inverse de `xml_to_table.py`.

> Le PDF `9370_cahierdescharges.pdf` joint au dépôt décrit **Simpl-IS** (impôt sur les sociétés). Le relevé TVA utilise le schéma `DeclarationReleveDeduction` des exemples XML fournis.

Règles appliquées (alignées EDI DGI) :

- dates au format `AAAA-MM-JJ`
- décimal avec `.`
- balises vides omises côté saisie (valeurs requises validées avant export XML)
