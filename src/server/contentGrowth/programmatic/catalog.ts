/**
 * Master catalog: 500 programmatic blog posts across all SEO/GEO clusters.
 */
import { EVERGREEN_SPECS } from '../evergreen/catalog.js';
import { COMPETITOR_SPECS } from '../competitors/buildCompetitorSpecs.js';
import { GEO_SPECS } from '../geo/buildGeoSpecs.js';
import { LOCATION_ROLE_SPECS } from './buildLocationRoleSpecs.js';
import { JOB_BOARD_SPECS } from './jobBoards.js';
import { TACTICS_SPECS } from './tacticsCatalog.js';
import { SKILLS_SPECS } from './skillsCatalog.js';
import { applyStaggeredPublishDates } from './stagger.js';
import { applyBlogFilterClusters } from './clusterRebalance.js';
import { applyCannibalization } from './cannibalization.js';
import type { EvergreenSpec } from '../evergreen/buildArticle.js';

export const PROGRAMMATIC_CLUSTERS = {
  evergreen: EVERGREEN_SPECS.length,
  competitors: COMPETITOR_SPECS.length,
  geo: GEO_SPECS.length,
  locationRole: LOCATION_ROLE_SPECS.length,
  jobBoards: JOB_BOARD_SPECS.length,
  tactics: TACTICS_SPECS.length,
  skills: SKILLS_SPECS.length,
} as const;

const RAW_SPECS: EvergreenSpec[] = [
  ...EVERGREEN_SPECS,
  ...COMPETITOR_SPECS,
  ...GEO_SPECS,
  ...LOCATION_ROLE_SPECS,
  ...JOB_BOARD_SPECS,
  ...TACTICS_SPECS,
  ...SKILLS_SPECS,
];

export const TARGET_PROGRAMMATIC_COUNT = 500;

export const ALL_PROGRAMMATIC_SPECS = applyCannibalization(
  applyStaggeredPublishDates(applyBlogFilterClusters(RAW_SPECS))
);

export const PROGRAMMATIC_POST_COUNT = ALL_PROGRAMMATIC_SPECS.length;

export function assertProgrammaticCatalogSize(expected = TARGET_PROGRAMMATIC_COUNT): void {
  if (PROGRAMMATIC_POST_COUNT !== expected) {
    throw new Error(
      `Programmatic catalog has ${PROGRAMMATIC_POST_COUNT} posts, expected ${expected}. Clusters: ${JSON.stringify(PROGRAMMATIC_CLUSTERS)}`
    );
  }
}

export function listProgrammaticSlugsForLlms(): { cluster: string; slug: string; title: string }[] {
  return ALL_PROGRAMMATIC_SPECS.map((s) => ({
    cluster: s.clusterId ?? s.category,
    slug: s.slug,
    title: s.title,
  }));
}
