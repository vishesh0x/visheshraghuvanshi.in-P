import { queryOptions } from "@tanstack/react-query";

import {
  getPageMeta,
  getProjectBySlug,
  getResume,
  getSiteConfig,
  listNowItems,
  listProjects,
} from "./public.functions";

export const siteConfigQuery = () =>
  queryOptions({ queryKey: ["site-config"], queryFn: () => getSiteConfig() });

export const pageMetaQuery = () =>
  queryOptions({ queryKey: ["page-meta"], queryFn: () => getPageMeta() });

export const projectsQuery = () =>
  queryOptions({ queryKey: ["projects"], queryFn: () => listProjects() });

export const projectQuery = (slug: string) =>
  queryOptions({
    queryKey: ["project", slug],
    queryFn: () => getProjectBySlug({ data: { slug } }),
  });

export const nowQuery = () => queryOptions({ queryKey: ["now"], queryFn: () => listNowItems() });

export const resumeQuery = () =>
  queryOptions({ queryKey: ["resume"], queryFn: () => getResume() });
