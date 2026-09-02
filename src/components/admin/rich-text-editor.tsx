import Link from "@tiptap/extension-link";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

/**
 * Strip inline `color`/`background` styles (and legacy <font color>) from
 * HTML before it enters or leaves the editor. Content that was ever pasted
 * in from Word, Notion, Google Docs, etc. carries hardcoded inline colors
 * that override our theme CSS via specificity - this is what causes body
 * text to render pure black regardless of the admin dashboard's theme.
 */
function stripInlineColor(html: string): string {
  if (typeof window === "undefined" || !html) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll("[style]").forEach((el) => {
    const style = el.getAttribute("style") ?? "";
    const cleaned = style
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(
        (declaration) =>
          declaration &&
          !/^color\s*:/i.test(declaration) &&
          !/^background(-color)?\s*:/i.test(declaration),
      )
      .join("; ");
    if (cleaned) {
      el.setAttribute("style", cleaned);
    } else {
      el.removeAttribute("style");
    }
  });

  doc.querySelectorAll("font[color]").forEach((el) => el.removeAttribute("color"));

  return doc.body.innerHTML;
}

type ToolbarButton = {
  label: string;
  title: string;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const BUTTONS: ToolbarButton[] = [
  {
    label: "B",
    title: "Bold",
    isActive: (e) => e.isActive("bold"),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    label: "I",
    title: "Italic",
    isActive: (e) => e.isActive("italic"),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    label: "H2",
    title: "Heading",
    isActive: (e) => e.isActive("heading", { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "H3",
    title: "Subheading",
    isActive: (e) => e.isActive("heading", { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: "UL",
    title: "Bullet list",
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: "OL",
    title: "Numbered list",
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: "\u201C\u201D",
    title: "Quote",
    isActive: (e) => e.isActive("blockquote"),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    label: "</>",
    title: "Code block",
    isActive: (e) => e.isActive("codeBlock"),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
];

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noreferrer" } }),
    ],
    content: stripInlineColor(value),
    editorProps: {
      attributes: {
        class:
          "prose-technical [&_p]:text-foreground [&_li]:text-foreground min-h-[280px] max-w-none px-4 py-4 text-sm text-foreground caret-foreground outline-none focus:outline-none",
      },
      transformPastedHTML: (html) => stripInlineColor(html),
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(stripInlineColor(value), { emitUpdate: false });
    }
    // Only resync when the incoming document identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) {
    return <div className="min-h-[320px] border border-border bg-card text-foreground" />;
  }

  return (
    <div className="border border-border bg-card text-foreground">
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex flex-wrap items-center gap-px border-b border-border bg-border"
      >
        {BUTTONS.map((button) => (
          <button
            key={button.label}
            type="button"
            title={button.title}
            aria-label={button.title}
            aria-pressed={button.isActive(editor)}
            onClick={() => button.run(editor)}
            className={cn(
              "label-mono min-w-11 px-3 py-2.5 transition-colors",
              button.isActive(editor)
                ? "bg-signal text-signal-foreground"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {button.label}
          </button>
        ))}
        <button
          type="button"
          title="Link"
          aria-label="Insert or edit link"
          aria-pressed={editor.isActive("link")}
          onClick={() => {
            const previous = editor.getAttributes("link")["href"] as string | undefined;
            const url = window.prompt("Link URL", previous ?? "https://");
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor.chain().focus().setLink({ href: url }).run();
          }}
          className={cn(
            "label-mono min-w-11 px-3 py-2.5 transition-colors",
            editor.isActive("link")
              ? "bg-signal text-signal-foreground"
              : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          Link
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
