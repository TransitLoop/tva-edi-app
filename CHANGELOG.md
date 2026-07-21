# Changelog

All notable changes to **TVA EDI Relevé** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-07-22

### Added

- Desktop app (Tauri + React) for the TVA **relevé des déductions**
- Editable table: N° ordre, N° facture, Date facture, Fournisseur, IF, ICE, Désignation, Montant HT, Taux TVA, Montant TVA, Montant TTC
- Declaration header: IF déclarant, année, période, régime, mode de paiement
- Add / delete rows with automatic TVA and TTC calculation
- Optional columns: date paiement, mode paiement
- Menu **Modèle**: download CSV / Excel import templates
- Menu **Fichier**: import CSV, Excel, or XML
- Menu **Exporter**: export CSV, Excel, or generate `DeclarationReleveDeduction` XML (EDI DGI)
- XML generation aligned with sample declarations and reverse of `xml_to_table.py`

[Unreleased]: https://github.com/TransitLoop/tva-edi-app/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/TransitLoop/tva-edi-app/releases/tag/v0.1.0
