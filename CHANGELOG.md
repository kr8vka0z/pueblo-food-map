# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [0.1.8](https://github.com/kr8vka0z/pueblo-food-map/compare/v0.1.7...v0.1.8) (2026-07-23)


### Added

* **admin-auth:** Phase 3 dual-auth gate — Better Auth session on top of CF Access ([e1cb829](https://github.com/kr8vka0z/pueblo-food-map/commit/e1cb8295b2893f73fedf2aca3dc3cbd525bbc348))
* **admin:** edit + remove venue ([#255](https://github.com/kr8vka0z/pueblo-food-map/issues/255)) ([#264](https://github.com/kr8vka0z/pueblo-food-map/issues/264)) ([eaeaac4](https://github.com/kr8vka0z/pueblo-food-map/commit/eaeaac49fe694afda7d1a972d37ca2539da09474))
* **admin:** publish button ([#256](https://github.com/kr8vka0z/pueblo-food-map/issues/256)) ([#266](https://github.com/kr8vka0z/pueblo-food-map/issues/266)) ([8ab5bd8](https://github.com/kr8vka0z/pueblo-food-map/commit/8ab5bd87b024722ab45e609a4b2100aa5c78ddd2))
* **admin:** read-only venue list ([#253](https://github.com/kr8vka0z/pueblo-food-map/issues/253)) ([#261](https://github.com/kr8vka0z/pueblo-food-map/issues/261)) ([d8ac19e](https://github.com/kr8vka0z/pueblo-food-map/commit/d8ac19e393b430d66e09280d11e184d22d3aea80))
* **admin:** review queue ([#259](https://github.com/kr8vka0z/pueblo-food-map/issues/259)) ([24e3318](https://github.com/kr8vka0z/pueblo-food-map/commit/24e33182c2ecb2b3c40a7700849a6cd9b6888c6e))
* GitHub Actions deploy pipeline (robot-for-everything, Phase 2) ([#302](https://github.com/kr8vka0z/pueblo-food-map/issues/302)) ([6ebd6f8](https://github.com/kr8vka0z/pueblo-food-map/commit/6ebd6f8c3de2aa2d98f55592f104749a977cf3ba))
* Healthchecks.io dead-man's-switch + CI on dev PRs (Phase 2 slice 2) ([#305](https://github.com/kr8vka0z/pueblo-food-map/issues/305)) ([0008901](https://github.com/kr8vka0z/pueblo-food-map/commit/0008901bce8975ea81594979e5e49bb32efcc5bc))
* Phase 2 — GitHub Actions robot deploy (dev → main cutover) ([#308](https://github.com/kr8vka0z/pueblo-food-map/issues/308)) ([40e8a85](https://github.com/kr8vka0z/pueblo-food-map/commit/40e8a85c422b8d8629420a8796145d523ebda349))
* **seo:** /venues directory + /about FAQ, cited stat & FAQPage schema ([#277](https://github.com/kr8vka0z/pueblo-food-map/issues/277)) ([936c96e](https://github.com/kr8vka0z/pueblo-food-map/commit/936c96e811abcd6afc9ca9db15e5d406420780c9))
* **seo:** enrich structured data — venue opening hours + Organization entity ([#275](https://github.com/kr8vka0z/pueblo-food-map/issues/275)) ([c8c15c8](https://github.com/kr8vka0z/pueblo-food-map/commit/c8c15c8d077d4e192106cce2f1adecc4b80639fd))
* **seo:** unique venue descriptions, sitemap lastmod, config hardening + robots AI-bot policy ([#274](https://github.com/kr8vka0z/pueblo-food-map/issues/274)) ([18a19fa](https://github.com/kr8vka0z/pueblo-food-map/commit/18a19fa90a56c2efa7de45e5a1171a6e5500dd4b))
* **suggest:** require submitter email (client + server + i18n + a11y) ([#243](https://github.com/kr8vka0z/pueblo-food-map/issues/243)) ([705c4e7](https://github.com/kr8vka0z/pueblo-food-map/commit/705c4e70e55a30a4c8b51244e0da61dc610d4204)), closes [#232](https://github.com/kr8vka0z/pueblo-food-map/issues/232)


### Fixed

* **admin:** forward host to Better Auth so admin session resolves post-cutover ([#323](https://github.com/kr8vka0z/pueblo-food-map/issues/323)) ([0b56c69](https://github.com/kr8vka0z/pueblo-food-map/commit/0b56c698d38fc5afee87a0adf36d0775b1457538))
* **admin:** make Better Auth the sole admin identity gate ([bf55807](https://github.com/kr8vka0z/pueblo-food-map/commit/bf5580721ce60f14873d577806dc66c75d76b185))
* **admin:** redirect signed-in admins with a passkey straight to /admin ([#325](https://github.com/kr8vka0z/pueblo-food-map/issues/325)) ([94dd10d](https://github.com/kr8vka0z/pueblo-food-map/commit/94dd10d5a670bd7e64328144f49b39ade9211471))
* **admin:** stop nagging returning admins to set up a passkey ([#324](https://github.com/kr8vka0z/pueblo-food-map/issues/324)) ([3a0e00c](https://github.com/kr8vka0z/pueblo-food-map/commit/3a0e00c422add1e6122a39ac50f28a254274effd))
* **ci:** update action refs in weekly security audit workflow ([63dc50f](https://github.com/kr8vka0z/pueblo-food-map/commit/63dc50f88971fe59063bcf702a2b0ae49fb15388))
* deploy workflows need Node 22 (wrangler hard-requires &gt;=22) ([#303](https://github.com/kr8vka0z/pueblo-food-map/issues/303)) ([f10fc89](https://github.com/kr8vka0z/pueblo-food-map/commit/f10fc89b00ffc67c9a2791b622d0490e4566cd4c))
* **directions:** request location on Walk instead of routing from downtown ([#245](https://github.com/kr8vka0z/pueblo-food-map/issues/245)) ([2ae1a1f](https://github.com/kr8vka0z/pueblo-food-map/commit/2ae1a1fa9583ac90e73de8c8be634f9f93ee7344)), closes [#207](https://github.com/kr8vka0z/pueblo-food-map/issues/207)
* **map:** don't autozoom to all venues on initial load (complete [#231](https://github.com/kr8vka0z/pueblo-food-map/issues/231)) ([#249](https://github.com/kr8vka0z/pueblo-food-map/issues/249)) ([18f3bec](https://github.com/kr8vka0z/pueblo-food-map/commit/18f3bece68efff8205265e672ffea44da0b4cf04)), closes [#247](https://github.com/kr8vka0z/pueblo-food-map/issues/247)
* **map:** open at default home view on initial load ([#244](https://github.com/kr8vka0z/pueblo-food-map/issues/244)) ([bfdf1d4](https://github.com/kr8vka0z/pueblo-food-map/commit/bfdf1d4a1906a3068d6889e482eb0f4bbdbb0b4f)), closes [#231](https://github.com/kr8vka0z/pueblo-food-map/issues/231)
* **security:** upgrade express to 4.21.2 to resolve CVEs ([a9b237f](https://github.com/kr8vka0z/pueblo-food-map/commit/a9b237ff2474389a27e270c8c04b3b318e32c579))
* **seo:** server-render homepage headline + venue index ([#276](https://github.com/kr8vka0z/pueblo-food-map/issues/276)) ([017503b](https://github.com/kr8vka0z/pueblo-food-map/commit/017503bb266ef8e0e06fda34d2756b4896e958d8))


### Changed

* add Cloudflare-native admin spec (accepted 2026-07-01) ([#241](https://github.com/kr8vka0z/pueblo-food-map/issues/241)) ([2075f74](https://github.com/kr8vka0z/pueblo-food-map/commit/2075f7411bee54bc5853c43ec49ef0fb80246c27))
* **agents:** update Lighthouse CI section to the local-build model ([#230](https://github.com/kr8vka0z/pueblo-food-map/issues/230)) ([fdc375f](https://github.com/kr8vka0z/pueblo-food-map/commit/fdc375fe0922fdae6126366414167ce8c5d6786c)), closes [#229](https://github.com/kr8vka0z/pueblo-food-map/issues/229)
* **ci:** correct auto-merge comment — ruleset, not branch protection ([#224](https://github.com/kr8vka0z/pueblo-food-map/issues/224)) ([b1c597f](https://github.com/kr8vka0z/pueblo-food-map/commit/b1c597f6bacff370b701e47203993e13cc4b4d5f))
* **map:** defer Mapbox load until idle/interaction, eager on deep link ([#246](https://github.com/kr8vka0z/pueblo-food-map/issues/246)) ([7c36f47](https://github.com/kr8vka0z/pueblo-food-map/commit/7c36f47b744979f2d6ba733db522693c767e5917)), closes [#226](https://github.com/kr8vka0z/pueblo-food-map/issues/226)
* retire admin-subdomain refs; record apex /admin decision ([04769a6](https://github.com/kr8vka0z/pueblo-food-map/commit/04769a645cf190931941a37db004642d0fa97690))
* settle AGENTS.md on the GitHub Actions robot deploy model ([#309](https://github.com/kr8vka0z/pueblo-food-map/issues/309)) ([bd20fae](https://github.com/kr8vka0z/pueblo-food-map/commit/bd20faecee8135413763550ced16e4dd54b5112f))

## [0.1.7](https://github.com/kr8vka0z/pueblo-food-map/compare/v0.1.6...v0.1.7) (2026-06-30)


### Added

* /about page + site footer ([#155](https://github.com/kr8vka0z/pueblo-food-map/issues/155)) ([97eae3e](https://github.com/kr8vka0z/pueblo-food-map/commit/97eae3e7422b333bd98f8029b9a1d3d5064189bc))
* observability — health endpoint + structured form-error logging ([#163](https://github.com/kr8vka0z/pueblo-food-map/issues/163)) ([#196](https://github.com/kr8vka0z/pueblo-food-map/issues/196)) ([7a8103d](https://github.com/kr8vka0z/pueblo-food-map/commit/7a8103de5240390e01856510ce3ff401b29ef5f0))
* per-venue pages + structured data ([#164](https://github.com/kr8vka0z/pueblo-food-map/issues/164) 6.3/6.4) ([#198](https://github.com/kr8vka0z/pueblo-food-map/issues/198)) ([52b644b](https://github.com/kr8vka0z/pueblo-food-map/commit/52b644b4edbd0973ef16e47d3cb517fd94c65165))
* SEO metadata, OG preview image, sitemap & robots ([#164](https://github.com/kr8vka0z/pueblo-food-map/issues/164)) ([#197](https://github.com/kr8vka0z/pueblo-food-map/issues/197)) ([765c7f6](https://github.com/kr8vka0z/pueblo-food-map/commit/765c7f65f4d8dc02f40db247bf523d8d9ffaaa69))
* update favicon ([#190](https://github.com/kr8vka0z/pueblo-food-map/issues/190)) ([844b9c1](https://github.com/kr8vka0z/pueblo-food-map/commit/844b9c1e78defcb9968ad498316fe5be2a400cf1))
* Walk/Bus/Drive directions on venue cards ([#134](https://github.com/kr8vka0z/pueblo-food-map/issues/134)) ([50d28ff](https://github.com/kr8vka0z/pueblo-food-map/commit/50d28ff15d71a7eb851dc11cf8cfa4d92e062d0d))
* walking turn-by-turn directions + Google Maps walk handoff ([#208](https://github.com/kr8vka0z/pueblo-food-map/issues/208)) ([3a9732a](https://github.com/kr8vka0z/pueblo-food-map/commit/3a9732a559d849910f28091d2c74b24854db2dda))


### Fixed

* parse 12-hour AM/PM venue hours so open/closed status is correct ([#188](https://github.com/kr8vka0z/pueblo-food-map/issues/188)) ([b63bf8d](https://github.com/kr8vka0z/pueblo-food-map/commit/b63bf8d7fc3edf01fdfc6d914371782a5a8b1b12))
* route remaining hardcoded UI strings through i18n (es support) ([#189](https://github.com/kr8vka0z/pueblo-food-map/issues/189)) ([6040908](https://github.com/kr8vka0z/pueblo-food-map/commit/6040908130db1acfdd9d76ee1070d711aeece5df))
* **security:** harden public forms & site surface ([#160](https://github.com/kr8vka0z/pueblo-food-map/issues/160)) ([#193](https://github.com/kr8vka0z/pueblo-food-map/issues/193)) ([a8140f4](https://github.com/kr8vka0z/pueblo-food-map/commit/a8140f4fd9d0c90134b1ce4933580dd14fe9440d))
* **seo:** remove next.config ?venue= redirect that 500'd the homepage on OpenNext ([443eecc](https://github.com/kr8vka0z/pueblo-food-map/commit/443eeccfd4f4e19c2d8c3265a7f51e5c73956789))


### Changed

* **agents:** correct legacy ?venue= redirect section after hotfix ([#199](https://github.com/kr8vka0z/pueblo-food-map/issues/199)) ([ad6f80b](https://github.com/kr8vka0z/pueblo-food-map/commit/ad6f80b85c1417fb8815913a0b51e98cf7cdfe7a))
* **agents:** document Resend email key arrangement ([#195](https://github.com/kr8vka0z/pueblo-food-map/issues/195)) ([695d3f6](https://github.com/kr8vka0z/pueblo-food-map/commit/695d3f62c00a1c8a2dbb3d36fdabc763171c0f6c))
* bring repo to Documentation & Comment Standard ([#183](https://github.com/kr8vka0z/pueblo-food-map/issues/183)) ([baebba4](https://github.com/kr8vka0z/pueblo-food-map/commit/baebba44fb5bfea46fbf69439bef732347778521))
* correct CF Workers Builds env-var model (no Preview environment) ([#204](https://github.com/kr8vka0z/pueblo-food-map/issues/204)) ([5d182f0](https://github.com/kr8vka0z/pueblo-food-map/commit/5d182f05e76f362ae2d3dc661d0f3468321d4df3))
* dedupe shared helpers (rate limiter, day keys, Pueblo center) ([#184](https://github.com/kr8vka0z/pueblo-food-map/issues/184)) ([83e3c5a](https://github.com/kr8vka0z/pueblo-food-map/commit/83e3c5a61b7532332a37ebc1df11b2b9b2ec6383))
* drop stale Leaflet naming in map components ([#222](https://github.com/kr8vka0z/pueblo-food-map/issues/222)) ([6c36181](https://github.com/kr8vka0z/pueblo-food-map/commit/6c3618135ade70d0902b220b943ed96d41cb8554))
* Lane A quality foundation — code health ([#166](https://github.com/kr8vka0z/pueblo-food-map/issues/166)), TBT cut ([#202](https://github.com/kr8vka0z/pueblo-food-map/issues/202)), i18n guard ([#177](https://github.com/kr8vka0z/pueblo-food-map/issues/177)), CI gates ([#161](https://github.com/kr8vka0z/pueblo-food-map/issues/161)) ([664eb2b](https://github.com/kr8vka0z/pueblo-food-map/commit/664eb2b722f2631718c6c655e050ea086e145ed9))

## [0.1.6](https://github.com/kr8vka0z/pueblo-food-map/compare/v0.1.5...v0.1.6) (2026-06-18)


### Added

* improvements for spanish translations ([#169](https://github.com/kr8vka0z/pueblo-food-map/issues/169)) ([56a4d27](https://github.com/kr8vka0z/pueblo-food-map/commit/56a4d27024beb9f816c9dfa8d3de285cf68e48c0))

## [0.1.5](https://github.com/kr8vka0z/pueblo-food-map/compare/v0.1.4...v0.1.5) (2026-06-18)


### Added

* **#126:** "Open now" filter toggle in the category dropdown ([#143](https://github.com/kr8vka0z/pueblo-food-map/issues/143)) ([038e1aa](https://github.com/kr8vka0z/pueblo-food-map/commit/038e1aa271ef82a20afac7cf79391049bb6083e9)), closes [#126](https://github.com/kr8vka0z/pueblo-food-map/issues/126)
* **#127:** SNAP/WIC benefit flags (sourced) + filters ([#145](https://github.com/kr8vka0z/pueblo-food-map/issues/145)) ([4f0cf87](https://github.com/kr8vka0z/pueblo-food-map/commit/4f0cf8704a4c5b04bcb144d989bde9f9514ece5f)), closes [#127](https://github.com/kr8vka0z/pueblo-food-map/issues/127)
* **#128:** prominent "See on Plentiful" link in venue detail ([#144](https://github.com/kr8vka0z/pueblo-food-map/issues/144)) ([424cb27](https://github.com/kr8vka0z/pueblo-food-map/commit/424cb27ed96cbaf47f7a90ce1373a51486f31f61)), closes [#128](https://github.com/kr8vka0z/pueblo-food-map/issues/128)
* **#129:** Map | List view toggle with full-screen nearest-first list ([#152](https://github.com/kr8vka0z/pueblo-food-map/issues/152)) ([3146a10](https://github.com/kr8vka0z/pueblo-food-map/commit/3146a106b892e81dfb89c34d2294b17944e8fe12))
* **#131:** add "Get help" assistance links to the menu ([#142](https://github.com/kr8vka0z/pueblo-food-map/issues/142)) ([ee4a109](https://github.com/kr8vka0z/pueblo-food-map/commit/ee4a10935642da7849f81b24f2bfdc38e6fa2595)), closes [#131](https://github.com/kr8vka0z/pueblo-food-map/issues/131)
* **#132:** "Saved places" list in the menu (slice 9c) ([#149](https://github.com/kr8vka0z/pueblo-food-map/issues/149)) ([a02249c](https://github.com/kr8vka0z/pueblo-food-map/commit/a02249c8367d06c859d89e9abce34343534c4c0f))
* **#132:** on-device favorites store + star control on detail cards ([#148](https://github.com/kr8vka0z/pueblo-food-map/issues/148)) ([c08f065](https://github.com/kr8vka0z/pueblo-food-map/commit/c08f06571bf60041ee8d0fb570f2ebee1c4864a5))
* **#132:** share a place via native share sheet + copy-link (slice 9d) ([#151](https://github.com/kr8vka0z/pueblo-food-map/issues/151)) ([1e7c4ac](https://github.com/kr8vka0z/pueblo-food-map/commit/1e7c4ac698dee6e5ba5d82caa718966f1a68a64d))
* **#132:** venue deep-link routing (?venue=&lt;id&gt;) ([#147](https://github.com/kr8vka0z/pueblo-food-map/issues/147)) ([2232adf](https://github.com/kr8vka0z/pueblo-food-map/commit/2232adfd9d0c4082d402d30a6e2af5dd65028e5d))
* add a "Favorites" filter to the search dropdown ([#153](https://github.com/kr8vka0z/pueblo-food-map/issues/153)) ([b8e35e1](https://github.com/kr8vka0z/pueblo-food-map/commit/b8e35e13b5bb8b5bd31fbdc46d4c5e60bd2ddb40))
* add Double Up Food Bucks to the "Get help" menu ([#146](https://github.com/kr8vka0z/pueblo-food-map/issues/146)) ([f23ecf7](https://github.com/kr8vka0z/pueblo-food-map/commit/f23ecf793a072bd4e7f7e7e1eff6b1beca8a0662))
* move the Map/List toggle into the hamburger menu ([#154](https://github.com/kr8vka0z/pueblo-food-map/issues/154)) ([9b93479](https://github.com/kr8vka0z/pueblo-food-map/commit/9b9347982d3d9aec9f5be474ccaf20ed54a6bf74))


### Fixed

* **#121:** venue detail card hugs content height (no dead space) ([#137](https://github.com/kr8vka0z/pueblo-food-map/issues/137)) ([e65d195](https://github.com/kr8vka0z/pueblo-food-map/commit/e65d195ae2ecd47656561212c75a48e42d132e07)), closes [#121](https://github.com/kr8vka0z/pueblo-food-map/issues/121)
* **#122:** mobile card polish — drop drag handle, move locate button up ([#138](https://github.com/kr8vka0z/pueblo-food-map/issues/138)) ([f5031ee](https://github.com/kr8vka0z/pueblo-food-map/commit/f5031eecf28f42ac576b47609ffffa3b09b20851))
* **#122:** mobile venue card expand via Show/Hide details toggle ([#135](https://github.com/kr8vka0z/pueblo-food-map/issues/135)) ([f469ed9](https://github.com/kr8vka0z/pueblo-food-map/commit/f469ed9ca37efc2ef1e9ce7c9e08a707953e3516)), closes [#122](https://github.com/kr8vka0z/pueblo-food-map/issues/122)
* **#123:** recenter flies to user even with a venue selected ([#139](https://github.com/kr8vka0z/pueblo-food-map/issues/139)) ([1bb6de5](https://github.com/kr8vka0z/pueblo-food-map/commit/1bb6de5fdb35785a324600356c22e67703f24e74)), closes [#123](https://github.com/kr8vka0z/pueblo-food-map/issues/123)
* **#124:** menu title "Pueblo Food Map"; move About to the bottom ([#140](https://github.com/kr8vka0z/pueblo-food-map/issues/140)) ([3c8764a](https://github.com/kr8vka0z/pueblo-food-map/commit/3c8764a3ad26331270ca44a63dbf80f7a377f870)), closes [#124](https://github.com/kr8vka0z/pueblo-food-map/issues/124)
* splash "Find food near me" locates immediately (no second tap) ([#141](https://github.com/kr8vka0z/pueblo-food-map/issues/141)) ([39117db](https://github.com/kr8vka0z/pueblo-food-map/commit/39117db3dba916460fb103b365eb1b5566d9dac3))

## [0.1.4](https://github.com/kr8vka0z/pueblo-food-map/compare/v0.1.3...v0.1.4) (2026-05-30)


### Added

* add Send-us-feedback form to hamburger menu ([#116](https://github.com/kr8vka0z/pueblo-food-map/issues/116)) ([#117](https://github.com/kr8vka0z/pueblo-food-map/issues/117)) ([f17cb59](https://github.com/kr8vka0z/pueblo-food-map/commit/f17cb596ed7dab2ab2fab9aafe50fa2657163269))
* auto-zoom map to fit the selected category ([#111](https://github.com/kr8vka0z/pueblo-food-map/issues/111)) ([#115](https://github.com/kr8vka0z/pueblo-food-map/issues/115)) ([f13167b](https://github.com/kr8vka0z/pueblo-food-map/commit/f13167bd28fcc224ad2bf06e9bcf92d96e5ee8bd))
* map chrome and menu refresh ([#97](https://github.com/kr8vka0z/pueblo-food-map/issues/97), [#95](https://github.com/kr8vka0z/pueblo-food-map/issues/95), [#96](https://github.com/kr8vka0z/pueblo-food-map/issues/96), [#99](https://github.com/kr8vka0z/pueblo-food-map/issues/99)) ([#103](https://github.com/kr8vka0z/pueblo-food-map/issues/103)) ([e2dfc95](https://github.com/kr8vka0z/pueblo-food-map/commit/e2dfc955b0dc955ced225321fa6114163d36de9b))
* move EN/ES language switch into the hamburger menu ([#109](https://github.com/kr8vka0z/pueblo-food-map/issues/109)) ([#113](https://github.com/kr8vka0z/pueblo-food-map/issues/113)) ([df597b0](https://github.com/kr8vka0z/pueblo-food-map/commit/df597b00048ad2d8feaf66de38f46fe4c8f822c1))
* single bottom-center location control with locating/re-center states ([#108](https://github.com/kr8vka0z/pueblo-food-map/issues/108)) ([#114](https://github.com/kr8vka0z/pueblo-food-map/issues/114)) ([e351311](https://github.com/kr8vka0z/pueblo-food-map/commit/e351311b3965ca1cd3643589ac1f649cdc9b24f5))
* **splash:** frosted overlay over live map with map lock ([#107](https://github.com/kr8vka0z/pueblo-food-map/issues/107)) ([808606f](https://github.com/kr8vka0z/pueblo-food-map/commit/808606f8e774b4f91a37e52f02db27f6a38e4e29))
* **splash:** refresh splash screen layout and content ([#100](https://github.com/kr8vka0z/pueblo-food-map/issues/100)) ([#106](https://github.com/kr8vka0z/pueblo-food-map/issues/106)) ([7913151](https://github.com/kr8vka0z/pueblo-food-map/commit/791315168085b7d445f06d6b7e8da1dc09f7e960))


### Fixed

* **#98:** scrub OSM artifacts from venue cards — clean hours strings, geocode missing addresses ([#102](https://github.com/kr8vka0z/pueblo-food-map/issues/102)) ([c1e4536](https://github.com/kr8vka0z/pueblo-food-map/commit/c1e4536df1e55a57486233d7e5a0e9f1e2da9235))
* **a11y:** dynamic aria-controls for search combobox per active listbox ([#105](https://github.com/kr8vka0z/pueblo-food-map/issues/105)) ([e08eee5](https://github.com/kr8vka0z/pueblo-food-map/commit/e08eee58df1411d61d236aeb686fbfa46510e22b))
* bump search input to 16px on mobile to stop iOS focus-zoom ([#110](https://github.com/kr8vka0z/pueblo-food-map/issues/110)) ([#112](https://github.com/kr8vka0z/pueblo-food-map/issues/112)) ([d9310f8](https://github.com/kr8vka0z/pueblo-food-map/commit/d9310f8546694cdeb097b33895240dac8f67086b))

## [0.1.3](https://github.com/kr8vka0z/pueblo-food-map/compare/v0.1.2...v0.1.3) (2026-05-28)


### Added

* add Cloudflare Workers deploy via OpenNext adapter ([#38](https://github.com/kr8vka0z/pueblo-food-map/issues/38)) ([#49](https://github.com/kr8vka0z/pueblo-food-map/issues/49)) ([189f4e5](https://github.com/kr8vka0z/pueblo-food-map/commit/189f4e56870b046b571d9ba9486133ddc3976096))
* complete Mapbox migration — tests, a11y, docs, Lighthouse re-baseline ([#48](https://github.com/kr8vka0z/pueblo-food-map/issues/48)) ([#59](https://github.com/kr8vka0z/pueblo-food-map/issues/59)) ([e162b44](https://github.com/kr8vka0z/pueblo-food-map/commit/e162b44a3d88179994fc5e776843870714bd952e))
* **i18n:** add EN/ES language toggle ([#68](https://github.com/kr8vka0z/pueblo-food-map/issues/68)) ([#86](https://github.com/kr8vka0z/pueblo-food-map/issues/86)) ([cc0a12c](https://github.com/kr8vka0z/pueblo-food-map/commit/cc0a12c2f49e9b9c425c2784f7d4dc4a1f0ba9dd))
* **map:** add collapsible category color legend ([#72](https://github.com/kr8vka0z/pueblo-food-map/issues/72)) ([#83](https://github.com/kr8vka0z/pueblo-food-map/issues/83)) ([bf2949d](https://github.com/kr8vka0z/pueblo-food-map/commit/bf2949d86cfb417416e79cd866ff3c6af078ebbb))
* **map:** add persistent wordmark that resets map state ([#61](https://github.com/kr8vka0z/pueblo-food-map/issues/61)) ([#89](https://github.com/kr8vka0z/pueblo-food-map/issues/89)) ([498f3b4](https://github.com/kr8vka0z/pueblo-food-map/commit/498f3b4ffa42e5fce711a6e3666add84b546d722))
* **map:** add sponsored by PFP credit link ([#69](https://github.com/kr8vka0z/pueblo-food-map/issues/69)) ([#80](https://github.com/kr8vka0z/pueblo-food-map/issues/80)) ([debf650](https://github.com/kr8vka0z/pueblo-food-map/commit/debf6505ef683023576799f3c54997f7ddfe2714))
* **map:** constrain map view to Pueblo County ([#62](https://github.com/kr8vka0z/pueblo-food-map/issues/62)) ([#87](https://github.com/kr8vka0z/pueblo-food-map/issues/87)) ([bfc3309](https://github.com/kr8vka0z/pueblo-food-map/commit/bfc3309c34aa4fa78f7ef18fb64e125f07a2bfcd))
* **map:** port flyTo / fitBounds / locate flow + reduced-motion guards ([#47](https://github.com/kr8vka0z/pueblo-food-map/issues/47)) ([#58](https://github.com/kr8vka0z/pueblo-food-map/issues/58)) ([e4241bc](https://github.com/kr8vka0z/pueblo-food-map/commit/e4241bcdfa5b5993a06bbb731053fee9a438c4e5))
* **map:** port tooltips, user-location dot, attribution to Mapbox ([#57](https://github.com/kr8vka0z/pueblo-food-map/issues/57)) ([17095d8](https://github.com/kr8vka0z/pueblo-food-map/commit/17095d86498cc370634463b02cc2ff4f29784844)), closes [#46](https://github.com/kr8vka0z/pueblo-food-map/issues/46)
* **map:** port venue markers to Mapbox + Lucide MapPin icon ([#45](https://github.com/kr8vka0z/pueblo-food-map/issues/45)) ([394263e](https://github.com/kr8vka0z/pueblo-food-map/commit/394263eb7c1ba5e56f4c1a2c74be8f33fb60baa3))
* **map:** swap Leaflet for Mapbox GL JS bare basemap ([#44](https://github.com/kr8vka0z/pueblo-food-map/issues/44)) ([#55](https://github.com/kr8vka0z/pueblo-food-map/issues/55)) ([692057f](https://github.com/kr8vka0z/pueblo-food-map/commit/692057f659edb7f76ced0538ad2b9ebdb7478771))
* **report:** venue issue report button + form + email send (closes [#70](https://github.com/kr8vka0z/pueblo-food-map/issues/70)) ([#92](https://github.com/kr8vka0z/pueblo-food-map/issues/92)) ([1b76e3a](https://github.com/kr8vka0z/pueblo-food-map/commit/1b76e3a1cbc2e4b7e07a870a1b2dbda35004072d))
* **search:** add live typeahead results dropdown ([#67](https://github.com/kr8vka0z/pueblo-food-map/issues/67)) ([#90](https://github.com/kr8vka0z/pueblo-food-map/issues/90)) ([edbf70f](https://github.com/kr8vka0z/pueblo-food-map/commit/edbf70f8a65b575ff5ab8f26808f7684efc31b4e))
* **security:** add Cloudflare Turnstile to submission forms (closes [#74](https://github.com/kr8vka0z/pueblo-food-map/issues/74)) ([#94](https://github.com/kr8vka0z/pueblo-food-map/issues/94)) ([0cbcb8e](https://github.com/kr8vka0z/pueblo-food-map/commit/0cbcb8e24c72a96ee3c203c70b4672183fcd3400))
* **suggest:** hamburger menu + suggest-a-venue form + email send (closes [#71](https://github.com/kr8vka0z/pueblo-food-map/issues/71)) ([#93](https://github.com/kr8vka0z/pueblo-food-map/issues/93)) ([b331461](https://github.com/kr8vka0z/pueblo-food-map/commit/b331461bc05f26f59742ccd6405a6854fb19f6f1))
* **venue:** add operator field + PFP attribution in popups ([#63](https://github.com/kr8vka0z/pueblo-food-map/issues/63)) ([#85](https://github.com/kr8vka0z/pueblo-food-map/issues/85)) ([bc58587](https://github.com/kr8vka0z/pueblo-food-map/commit/bc585871a3503092e99cc4f19e2b96c99ad9a9dd))
* **venue:** persistent venue popup header bar ([#64](https://github.com/kr8vka0z/pueblo-food-map/issues/64)) ([#88](https://github.com/kr8vka0z/pueblo-food-map/issues/88)) ([381904c](https://github.com/kr8vka0z/pueblo-food-map/commit/381904c9dcb6d1c9ad4dcd6449cda94723b1bd1d))


### Fixed

* **map:** locate button recenters on every tap ([#60](https://github.com/kr8vka0z/pueblo-food-map/issues/60)) ([#79](https://github.com/kr8vka0z/pueblo-food-map/issues/79)) ([47db6ce](https://github.com/kr8vka0z/pueblo-food-map/commit/47db6ce1b75110bb6eb7bd04186d645c3f6338dc))
* **venue:** today row highlight in hours list ([#66](https://github.com/kr8vka0z/pueblo-food-map/issues/66)) ([#81](https://github.com/kr8vka0z/pueblo-food-map/issues/81)) ([acbaf0b](https://github.com/kr8vka0z/pueblo-food-map/commit/acbaf0bbed9e71930afc079cfb15b7a0b63db057))


### Changed

* **agents:** document Cloudflare Workers deploy + CI flow ([#51](https://github.com/kr8vka0z/pueblo-food-map/issues/51)) ([6ed0779](https://github.com/kr8vka0z/pueblo-food-map/commit/6ed07797d5b0f363f8bd3f3baf05732859ed8ce7))
* **agents:** document Mapbox token management (public + secret tokens) ([#54](https://github.com/kr8vka0z/pueblo-food-map/issues/54)) ([3ab67f4](https://github.com/kr8vka0z/pueblo-food-map/commit/3ab67f49319c858436d1561d387b8f09ca8018f1)), closes [#43](https://github.com/kr8vka0z/pueblo-food-map/issues/43)
* switch production URL references to pueblofoodmap.com ([#52](https://github.com/kr8vka0z/pueblo-food-map/issues/52)) ([c3b55bc](https://github.com/kr8vka0z/pueblo-food-map/commit/c3b55bca49e73cdae8f9320e3c23d465033ada1b)), closes [#41](https://github.com/kr8vka0z/pueblo-food-map/issues/41)

## [0.1.2](https://github.com/kr8vka0z/pueblo-food-map/compare/v0.1.1...v0.1.2) (2026-05-17)


### Added

* **v2:** LocationDeniedBanner component ([#33](https://github.com/kr8vka0z/pueblo-food-map/issues/33)) ([b0a75c8](https://github.com/kr8vka0z/pueblo-food-map/commit/b0a75c804d6421a62a8c21d0bd5d80030b73bc90))
* **v2:** Lucide MapPin pin markers with category color + sage selected ring ([#27](https://github.com/kr8vka0z/pueblo-food-map/issues/27)) ([076097a](https://github.com/kr8vka0z/pueblo-food-map/commit/076097a3f2aa0fcab77cada10aaa1cf6c4b103ed))
* **v2:** searchVenues filter (name + readable category) ([#31](https://github.com/kr8vka0z/pueblo-food-map/issues/31)) ([5ef9059](https://github.com/kr8vka0z/pueblo-food-map/commit/5ef9059e0b431859881f56446035fa3121fcad3f))
* **v2:** vaul-based BottomSheet v2 with peek/quick/full snap points + Dialog.Title fix ([#32](https://github.com/kr8vka0z/pueblo-food-map/issues/32)) ([ef3bfb6](https://github.com/kr8vka0z/pueblo-food-map/commit/ef3bfb6d19b948b612e6a3482c013f3ab2406f7e))


### Fixed

* restore body height so map container can resolve h-full ([#36](https://github.com/kr8vka0z/pueblo-food-map/issues/36)) ([46ceccb](https://github.com/kr8vka0z/pueblo-food-map/commit/46ceccb0251e4f8193b4d737062901d5faa25e3e))


### Changed

* **v2:** demo-readiness checklist ([#35](https://github.com/kr8vka0z/pueblo-food-map/issues/35)) ([4798c51](https://github.com/kr8vka0z/pueblo-food-map/commit/4798c51b236ec4967c7c092c3f8bcb5b0fa1c726))

## [0.1.1](https://github.com/kr8vka0z/pueblo-food-map/compare/v0.1.0...v0.1.1) (2026-05-15)


### Added

* **data:** ingest Plentiful pantry directory for Pueblo ([#21](https://github.com/kr8vka0z/pueblo-food-map/issues/21)) ([94b731d](https://github.com/kr8vka0z/pueblo-food-map/commit/94b731d7d49073f5a0b50e22562583370fbd6f20))
* **design:** land PR 2 — new layout, custom markers, search, basemap, detail panel ([#22](https://github.com/kr8vka0z/pueblo-food-map/issues/22)) ([d21caca](https://github.com/kr8vka0z/pueblo-food-map/commit/d21cacaa33911f5e37feec598dc24ad32d76271c))
* **design:** PR 3 — Spanish translations, empty states, reduced motion ([#23](https://github.com/kr8vka0z/pueblo-food-map/issues/23)) ([a433e91](https://github.com/kr8vka0z/pueblo-food-map/commit/a433e91244a74ac7fc13b9c63f1cd099a2bfd78d))
* **design:** swap to Inter + Fraunces and add full design-system token set ([#20](https://github.com/kr8vka0z/pueblo-food-map/issues/20)) ([380f7b6](https://github.com/kr8vka0z/pueblo-food-map/commit/380f7b60ebd43714e7b1c4f1f8aaa05c01331761))

## [Unreleased]

### Added

- `scripts/geocode-pfp.py` — reproducible Nominatim geocoder for the ten PFP
  venues. Honors Nominatim's usage policy (custom User-Agent with contact
  email, 1.1s rate limit, Pueblo-county `viewbox` bias) and supports per-id
  manual overrides for addresses Nominatim cannot resolve to a single node.
  Writes a full audit trail to `data/raw/pfp-geocodes.json`.

### Changed

- Replaced the placeholder latitude/longitude on every PFP community garden and
  edible-landscape venue with precise geocodes from Nominatim. Some pins
  shifted by more than four miles, including Bethany Lutheran (4.30 mi),
  JJ Raigoza Park (3.37 mi), and Ray Aguilera Garden (3.27 mi). See
  `data/raw/pfp-geocodes.json` for the matched OSM ids and display names.
- Updated the listed address for La Familia Community Garden from the
  "5th & Hudson" intersection to "814 E 5th St, Pueblo, CO 81001" (the
  actual lot the garden sits on, per PFP).
- Ray Aguilera Community Garden uses a manual coordinate supplied by PFP
  because the garden plot sits south of the OSM Ray Aguilera Park centroid.

## [0.1.0] - 2026-05-12

### Added

- Initial scaffold of the Pueblo Food Access Map proof of concept (Next.js 16
  App Router, TypeScript, Tailwind v4, Leaflet + react-leaflet).
- Static venue data file (`src/data/venues.ts`) seeded with the ten Pueblo
  Food Project community gardens and edible landscapes from
  [pueblofoodproject.org/cgsp](https://pueblofoodproject.org/cgsp/).
- Distance-sorted sidebar listing every venue with a colored category dot,
  name, type, address, and Haversine distance in miles.
- Geolocation request on first load; when granted, the sidebar sorts from the
  user's actual position and a blue "You are here" marker is drawn on the
  map. When denied or unavailable, the sidebar falls back to distance from
  downtown Pueblo and shows a status message explaining why.
- Hover-driven Leaflet tooltips on every venue marker. Mousing over a marker
  reveals name, category, address, hours, contact info, and notes. Click in
  the sidebar to fly the map to that venue and visually emphasize its
  marker.
- Mobile responsive layout (sidebar stacks above map below the `md`
  breakpoint).

### Changed

- Replaced the default Next.js scaffold page with the production map UI.

[Unreleased]: https://github.com/kr8vka0z/pueblo-food-map/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/kr8vka0z/pueblo-food-map/releases/tag/v0.1.0
