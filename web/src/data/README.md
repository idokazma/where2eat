# Stories place-name snapshot

Built on 2026-11-24 by `python scripts/build_story_places.py` from repository root.

## Distributed data

`israel-places.json`: 951 entries. 946 qualified locality records, 4 reviewed geographic-region representative points, 1 market. Source coordinates and original names/aliases: GeoNames, https://www.geonames.org/ . Licensed CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ . This snapshot filters and normalizes the original data and adds reviewed Hebrew display/search spellings for curated regions. It is not the original complete GeoNames database.

Source: https://download.geonames.org/export/dump/IL.zip . Format and license: https://download.geonames.org/export/dump/readme.txt . Data is provided as-is. Preserve the visible attribution in the component when updating.

For locality qualification, the build compares against the official Population and Immigration Authority name list, resource `8f714b6f-c35c-4b40-a0e7-547b675eee0e`, https://data.gov.il/dataset/citiesandsettelments . The official list is used as a build-time audit input only; distributed locality display names/aliases and coordinates come from GeoNames. Official codes appear in the audit to identify unresolved joins, not as a claim that those places do not exist.

## Selection and coverage

Only active locality feature codes are candidates. Abandoned/historical entries and neighborhoods are not automatically imported. Require exactly one normalized name match across the two datasets, a matching Hebrew GeoNames alias, and a sane regional coordinate. Omit ambiguous/no-match records, rather than invent coordinates or choose between namesakes. Multiple official names can refer to one GeoNames ID; distributed IDs are unique.

The index does not cover every locality in Israel, every neighborhood, street or colloquial region. No such coverage promise is made in the UI. Audit details and omissions are in `israel-places-audit.json`. The index has no relation to how many restaurants we currently cover in a locality.

Curated representative points:
- Ra'anana is a qualified locality, GeoNames293807: https://www.geonames.org/293807/ra-anana.html . Coordinates32.18360,34.87386.
- Golan Heights,173708,32.90485,35.80725: https://www.geonames.org/173708/golan-heights.html . Region representative point, not a computed centroid or boundary.
- Negev294886, HaShefela294850, Judean Desert293269, Carmel Market8623762: coordinate and original-name records from the same publisher snapshot; Hebrew labels and simple short aliases reviewed in the build script.

Country exports are dataset classifications, not product policy about disputed borders. No political or exhaustive national-boundary coverage is inferred from `IL.zip`. Extending coverage requires reviewing the appropriate additional records/sources.

## Runtime and maintenance

The index is lazy-loaded as a static application chunk on focus, searched locally, and cached by the browser/module loader. No Google/Nominatim/Photon request on typing or selection. No new service key or per-query bill. Normal application hosting/bandwidth still applies. Restaurant photos retain their separate existing network/cost behavior.

Selection is explicit. A locality/region is a starting coordinate for existing1/3/10/50km bands and upload-date ordering, with farther catalog results continuing afterward. A region does not impose a boundary or a strict radius. At real catalog exhaustion, do not invent repeated results.

Refresh is manual, not a newly scheduled responsibility. Re-run the builder, review additions/removals, audit ambiguous names, verify required examples and common cities, inspect the diff, and run tests before publishing a new snapshot. No runtime fallback to a paid geocoder.
