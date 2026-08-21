# Game Content Rights Policy

## Purpose

Deckwright stores game definitions as distributable Markdown. A game's rules,
artwork, branding, and other expressive content can therefore raise rights
questions independently from the Deckwright application code.

This document sets a conservative contribution policy for the repository. It
is operational guidance for Deckwright contributors, not legal advice.

## What may be reused

Game ideas, procedures, systems, and methods of play do not need to be in the
public domain before Deckwright can implement them. Copyright protects an
author's particular expression rather than the underlying method.

Official guidance supporting that distinction includes:

- The [U.S. Copyright Office guidance for games](https://www.copyright.gov/register/tx-games.html),
  which distinguishes game ideas and methods of play from copyrightable rule
  text and artwork.
- The [European Commission IP Helpdesk](https://intellectual-property-helpdesk.ec.europa.eu/regional-helpdesks/europe-frequently-asked-questions_en),
  which explains that copyright protects expressions rather than ideas,
  procedures, or methods of operation.
- Article 2 of the [WIPO Copyright Treaty](https://www.wipo.int/edocs/mdocs/mdocs/en/wipo_int_sin_98/wipo_int_sin_98_8-main1.html),
  which states the same international idea/expression principle.

Accordingly, a Deckwright game may use general mechanics such as hidden roles,
alternating phases, elimination votes, score counters, drawing cards, or
comparing card values. Its rule text, examples, role descriptions, setting,
and presentation must be independently written.

## What must not be copied

Do not submit any of the following unless the repository has documented,
compatible permission for the specific material:

- rulebook wording, explanatory examples, flavor text, or translations;
- illustrations, card faces, icons, logos, typography, or other artwork;
- software source, data copied from an implementation, or proprietary files;
- distinctive characters, settings, story material, or branded role sets; or
- a commercial product's packaging, visual identity, or trade dress.

Knowing how a game works is not permission to copy the way a particular
publisher explains or presents it. Rephrase-by-editing is also insufficient;
repository rules must be independently authored from the mechanics upward.

## Names and trademarks

Copyright generally does not protect a game's name or title, but trademark and
unfair-competition rules are separate. The USPTO recommends a clearance search
because a similar mark used for related goods or services can create a
[likelihood of confusion](https://www.uspto.gov/trademarks/search/likelihood-confusion).
The [Benelux Office for Intellectual Property](https://support.boip.int/hc/nl/articles/23546426852625-Mijn-naam-staat-al-in-het-BOIP-Merkenregister-Kan-ik-die-naam-nu-nog-wel-kiezen)
similarly recommends checking the registered goods and services and broader
market use.

Before a built-in example receives its final name:

1. Search the USPTO, BOIP, and EUIPO trademark databases.
2. Search the web and relevant game catalogs for confusingly similar uses.
3. Prefer an original or clearly descriptive title.
4. Do not use another product's logo, stylization, or claim of affiliation.
5. Record the search date and result in the example's rights record.

A phrase such as “social-deduction example” may describe mechanics. It must
not imply that Deckwright publishes an official edition of another product.

## Repository content policy

For the first usable release, every built-in example must be original
Deckwright content:

- contributors write the rules and examples themselves;
- only common deck facts and general game mechanics are reused;
- no third-party artwork or game-owned assets are included;
- tarot examples use original text and no copied deck-specific imagery or
  guidebook interpretations; and
- the contribution is provided under the repository's MIT License.

Public-domain or third-party licensed content is not required for the first
release. A future contribution containing such material must include reliable
provenance, the exact license or public-domain basis, all required attribution,
and maintainer approval. It must not be silently relicensed as MIT content.

Each repository game will have `games/<game-id>/RIGHTS.md` containing:

- authorship and copyright holder;
- applicable license;
- whether the work is original, public domain, or used with permission;
- sources for any reused public-domain or licensed material; and
- the date and scope of its name-clearance search.

## Planned examples

The example concepts in the roadmap remain valid, but their names are working
titles until clearance is recorded:

- an originally named social-deduction game using common hidden-role mechanics;
- an originally named standard-card comparison game; and
- an originally named tarot journaling or reflection game.

None will reproduce the rules, art, branding, or distinctive content of a
published game or tarot product.

## Contributor checklist

Before proposing a game, confirm that:

- [ ] I wrote the submitted rules and presentation independently.
- [ ] I did not copy or closely paraphrase a published rulebook.
- [ ] I did not include third-party art, logos, characters, or product files.
- [ ] I completed `RIGHTS.md` with authorship, license, and name-search details.
- [ ] I can document permission and attribution for every non-original item.
- [ ] The contribution does not claim or imply endorsement by another creator.

When ownership, provenance, or naming remains uncertain, omit the material
until it has been reviewed. A repository maintainer may request specialist
legal advice for a contribution with unusual rights questions.
