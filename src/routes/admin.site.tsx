import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AssetInput } from "@/components/admin/asset-input";
import { AdminButton, AdminField, AdminPage, adminInputClass } from "@/components/admin/ui";

import { updateSiteConfig } from "@/lib/cms/admin.functions";
import { getSiteConfig } from "@/lib/cms/public.functions";
import { siteConfigInputSchema, type SiteConfigInput } from "@/lib/cms/types";

export const Route = createFileRoute("/admin/site")({
  component: SiteConfigPage,
});

const EMPTY: SiteConfigInput = {
  owner_name: "",
  initials: "",
  system_name: "",
  status: "",
  location: "",
  hero_line_one: "",
  hero_line_two: "",
  bio: "",
  contact_email: "",
  meta_description: "",
  build_version: "",
  resume_pdf_url: null,
  socials: [],
  site_title: "",
  favicon_url: null,
  now_categories: [],
};

function SiteConfigPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["site-config"], queryFn: () => getSiteConfig() });
  const [form, setForm] = useState<SiteConfigInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setForm({
      owner_name: data.owner_name,
      initials: data.initials,
      system_name: data.system_name,
      status: data.status,
      location: data.location,
      hero_line_one: data.hero_line_one,
      hero_line_two: data.hero_line_two,
      bio: data.bio,
      contact_email: data.contact_email,
      meta_description: data.meta_description,
      build_version: data.build_version,
      resume_pdf_url: data.resume_pdf_url,
      socials: data.socials,
      site_title: data.site_title,
      favicon_url: data.favicon_url,
      now_categories: data.now_categories,
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: (values: SiteConfigInput) => updateSiteConfig({ data: values }),
    onSuccess: async () => {
      toast.success("Site configuration saved.");
      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function set<K extends keyof SiteConfigInput>(key: K, value: SiteConfigInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = siteConfigInputSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast.error("Fix the highlighted fields.");
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  }

  return (
    <AdminPage
      title="Site config"
      description="Identity, hero copy, contact routes and metadata for the whole public site."
      actions={
        <AdminButton variant="primary" form="site-config-form" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </AdminButton>
      }
    >
      <form id="site-config-form" onSubmit={submit} className="max-w-3xl space-y-8">
        <section className="grid gap-6 sm:grid-cols-2">
          <AdminField label="Owner name" error={errors["owner_name"]}>
            <input
              className={adminInputClass}
              value={form.owner_name}
              onChange={(event) => set("owner_name", event.target.value)}
            />
          </AdminField>
          <AdminField label="Initials" hint="max 6" error={errors["initials"]}>
            <input
              className={adminInputClass}
              value={form.initials}
              onChange={(event) => set("initials", event.target.value)}
            />
          </AdminField>
          <AdminField label="System name" error={errors["system_name"]}>
            <input
              className={adminInputClass}
              value={form.system_name}
              onChange={(event) => set("system_name", event.target.value)}
            />
          </AdminField>
          <AdminField label="Status" error={errors["status"]}>
            <input
              className={adminInputClass}
              value={form.status}
              onChange={(event) => set("status", event.target.value)}
            />
          </AdminField>
          <AdminField label="Location" error={errors["location"]}>
            <input
              className={adminInputClass}
              value={form.location}
              onChange={(event) => set("location", event.target.value)}
            />
          </AdminField>
          <AdminField label="Build version" error={errors["build_version"]}>
            <input
              className={adminInputClass}
              value={form.build_version}
              onChange={(event) => set("build_version", event.target.value)}
            />
          </AdminField>
        </section>

        <section className="space-y-6 border-t border-border pt-8">
          <AdminField label="Hero line one" error={errors["hero_line_one"]}>
            <input
              className={adminInputClass}
              value={form.hero_line_one}
              onChange={(event) => set("hero_line_one", event.target.value)}
            />
          </AdminField>
          <AdminField label="Hero line two" error={errors["hero_line_two"]}>
            <input
              className={adminInputClass}
              value={form.hero_line_two}
              onChange={(event) => set("hero_line_two", event.target.value)}
            />
          </AdminField>
          <AdminField label="Bio" error={errors["bio"]}>
            <textarea
              rows={5}
              className={`${adminInputClass} resize-y leading-relaxed`}
              value={form.bio}
              onChange={(event) => set("bio", event.target.value)}
            />
          </AdminField>
        </section>

        <section className="grid gap-6 border-t border-border pt-8 sm:grid-cols-2">
          <AdminField label="Contact email" error={errors["contact_email"]}>
            <input
              className={adminInputClass}
              value={form.contact_email}
              onChange={(event) => set("contact_email", event.target.value)}
            />
          </AdminField>
          <AdminField label="Resume PDF" hint="optional - upload or paste a URL" error={errors["resume_pdf_url"]}>
            <AssetInput
              value={form.resume_pdf_url}
              onChange={(value) => set("resume_pdf_url", value)}
              accept="application/pdf"
              placeholder="https://… or upload a PDF"
              preview={false}
            />
          </AdminField>

          <div className="sm:col-span-2">
            <AdminField label="Meta description" error={errors["meta_description"]}>
              <textarea
                rows={3}
                className={`${adminInputClass} resize-y`}
                value={form.meta_description}
                onChange={(event) => set("meta_description", event.target.value)}
              />
            </AdminField>
          </div>
        </section>

        <section className="grid gap-6 border-t border-border pt-8 sm:grid-cols-2">
          <AdminField
            label="Browser tab title"
            hint="<title>"
            error={errors["site_title"]}
          >
            <input
              className={adminInputClass}
              value={form.site_title}
              onChange={(event) => set("site_title", event.target.value)}
            />
          </AdminField>
          <AdminField
            label="Favicon"
            hint="optional - upload or paste a URL"
            error={errors["favicon_url"]}
          >
            <AssetInput
              value={form.favicon_url}
              onChange={(value) => set("favicon_url", value)}
              accept="image/png,image/x-icon,image/svg+xml,image/jpeg"
              placeholder="https://… or upload an icon"
            />
          </AdminField>
        </section>

        <section className="border-t border-border pt-8">
          <div className="flex items-center justify-between">
            <span className="label-mono text-muted-foreground">Social links</span>
            <AdminButton
              type="button"
              onClick={() => set("socials", [...form.socials, { label: "", url: "https://" }])}
            >
              Add link
            </AdminButton>
          </div>

          <div className="mt-4 space-y-3">
            {form.socials.map((social, index) => (
              <div key={index} className="flex flex-wrap gap-3">
                <input
                  className={`${adminInputClass} sm:w-40`}
                  placeholder="Label"
                  value={social.label}
                  onChange={(event) => {
                    const next = [...form.socials];
                    next[index] = { ...social, label: event.target.value };
                    set("socials", next);
                  }}
                />
                <input
                  className={`${adminInputClass} flex-1`}
                  placeholder="https://"
                  value={social.url}
                  onChange={(event) => {
                    const next = [...form.socials];
                    next[index] = { ...social, url: event.target.value };
                    set("socials", next);
                  }}
                />
                <AdminButton
                  type="button"
                  variant="danger"
                  onClick={() => set("socials", form.socials.filter((_, i) => i !== index))}
                >
                  Remove
                </AdminButton>
              </div>
            ))}
            {form.socials.length === 0 ? (
              <p className="label-mono text-muted-foreground">No links configured.</p>
            ) : null}
            {errors["socials"] ? (
              <p className="label-mono text-destructive">{errors["socials"]}</p>
            ) : null}
          </div>
        </section>
      </form>
    </AdminPage>
  );
}
