"use client";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, Link as LinkIcon,
    RotateCcw, RotateCw, Eraser,
    Variable, Quote, Highlighter, Sparkles,
    Eye, EyeOff, Loader2, Indent, Outdent,
} from "lucide-react";
import { cn, getSmartGreeting, getFirstName, getLastName } from "@/shared/lib/utils";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { normalizeEmailBodyHtml } from "@/shared/lib/email-format";
import { apiPath } from "@/lib/app-path";
import { readEditorPrefs, writeEditorPrefs } from "@/lib/campaign-session";

// Custom Font Size Extension
const FontSize = Extension.create({
    name: "fontSize",
    addOptions() { return { types: ["textStyle"] }; },
    addGlobalAttributes() {
        return [{
            types: this.options.types,
            attributes: {
                fontSize: {
                    default: null,
                    parseHTML: (el: HTMLElement) => el.style.fontSize,
                    renderHTML: (attrs: any) => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
                },
            },
        }];
    },
    addCommands(): any {
        return {
            setFontSize: (fontSize: string) => ({ chain }: any) =>
                (chain() as any).setMark("textStyle", { fontSize }).run(),
            unsetFontSize: () => ({ chain }: any) =>
                (chain() as any).setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
        };
    },
});

const FONT_FAMILIES = [
    { label: "Sans Serif", value: "Arial, sans-serif" },
    { label: "Serif", value: "Georgia, serif" },
    { label: "Monospace", value: "Courier New, monospace" },
    { label: "Calibri", value: "Calibri, sans-serif" },
    { label: "Times New Roman", value: "Times New Roman, serif" },
];

const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    onSave?: () => void;
    onSend?: () => void;
    placeholder?: string;
    sampleData?: any;
}

function notifyAiRoutingStatus(aiRouting: any) {
    if (!aiRouting) return;
    if (aiRouting.providerUsed === "openrouter" && aiRouting.fallbackActive) {
        const retryAt = aiRouting.groqRetryAt
            ? new Date(aiRouting.groqRetryAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : null;
        toast.info(retryAt ? `Using backup AI. Groq auto-retry after ${retryAt}.` : "Using backup AI engine.");
    }
}

export function RichTextEditor({ content, onChange, onSave, onSend, placeholder, sampleData }: RichTextEditorProps) {
    const [isRefining, setIsRefining] = useState(false);
    const [showMagicMenu, setShowMagicMenu] = useState(false);
    const [isLivePreview, setIsLivePreview] = useState(false);
    const [historyState, setHistoryState] = useState({ index: 0, length: 1 });
    const [showVarMenu, setShowVarMenu] = useState(false);
    const [prefFontFamily, setPrefFontFamily] = useState("Calibri, sans-serif");
    const [prefFontSize, setPrefFontSize] = useState("14px");

    const historyRef = useRef<string[]>([normalizeEmailBodyHtml(content || "")]);
    const historyIndexRef = useRef<number>(0);
    const isApplyingHistoryRef = useRef<boolean>(false);
    const lastRecordedRef = useRef<string>(normalizeEmailBodyHtml(content || ""));

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ link: false, underline: false }),
            Underline,
            Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-blue-600 underline cursor-pointer" } }),
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            TextStyle,
            FontFamily,
            Color,
            FontSize,
            Highlight.configure({ multicolor: true }),
        ],
        content,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onChange(html);
            if (isApplyingHistoryRef.current || html === lastRecordedRef.current) return;
            if (historyIndexRef.current < historyRef.current.length - 1) {
                historyRef.current.splice(historyIndexRef.current + 1);
            }
            historyRef.current.push(html);
            historyIndexRef.current = historyRef.current.length - 1;
            lastRecordedRef.current = html;
            setHistoryState({ index: historyIndexRef.current, length: historyRef.current.length });
        },
        editorProps: {
            attributes: { class: "prose prose-sm max-w-none focus:outline-none min-h-[360px] px-8 py-6 text-slate-800" },
        },
    });

    // Load saved font prefs on mount
    useEffect(() => {
        const prefs = readEditorPrefs();
        setPrefFontFamily(prefs.fontFamily);
        setPrefFontSize(prefs.fontSize);
    }, []);

    // Apply font prefs (defaulting to Calibri 14px) when editor is ready
    useEffect(() => {
        if (!editor) return;
        const prefs = readEditorPrefs();
        const fontFamily = prefs.fontFamily || "Calibri, sans-serif";
        const fontSize = prefs.fontSize || "14px";
        editor.chain().selectAll().run();
        editor.chain().focus().setFontFamily(fontFamily).run();
        (editor.chain().focus() as any).setFontSize(fontSize).run();
        editor.commands.focus("end");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); onSave?.(); }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); onSend?.(); }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onSave, onSend]);

    useEffect(() => {
        if (!editor) return;
        const normalized = normalizeEmailBodyHtml(content || "");
        if (normalized.trim() === lastRecordedRef.current.trim()) return;
        const current = editor.getHTML();
        if (normalized.trim() !== current.trim()) {
            isApplyingHistoryRef.current = true;
            editor.commands.setContent(normalized);
            isApplyingHistoryRef.current = false;
        }
        historyRef.current.splice(0, historyRef.current.length, normalized);
        historyIndexRef.current = 0;
        lastRecordedRef.current = normalized;
        setHistoryState({ index: 0, length: 1 });

        // Re-apply font prefs (Calibri 14px default) to newly loaded content
        const prefs = readEditorPrefs();
        const fontFamily = prefs.fontFamily || "Calibri, sans-serif";
        const fontSize = prefs.fontSize || "14px";
        editor.chain().selectAll().run();
        editor.chain().focus().setFontFamily(fontFamily).run();
        (editor.chain().focus() as any).setFontSize(fontSize).run();
        editor.commands.focus("end");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content, editor]);

    const handleRefine = async (command: string, useFullBody = false) => {
        if (!editor) return;
        let textToRefine = "";
        let from = 0, to = 0;
        let isFullBody = useFullBody;

        if (!isFullBody) {
            const sel = editor.state.selection;
            from = sel.from; to = sel.to;
            textToRefine = editor.state.doc.textBetween(from, to, " ");
        }
        if (!textToRefine || textToRefine.length < 5) { isFullBody = true; textToRefine = editor.getHTML(); }
        if (!textToRefine || textToRefine.length < 5) { toast.error("No content to refine."); return; }

        setIsRefining(true);
        setShowMagicMenu(false);
        try {
            const res = await fetch(apiPath("/campaigns/refine"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: textToRefine, command }),
            });
            const data = await res.json();
            if (data.success) {
                notifyAiRoutingStatus(data.data?.aiRouting);
                const normalized = normalizeEmailBodyHtml(data.data.refinedText);
                if (isFullBody) {
                    isApplyingHistoryRef.current = true;
                    editor.commands.setContent(normalized);
                    isApplyingHistoryRef.current = false;
                    onChange(normalized);
                    if (normalized !== lastRecordedRef.current) {
                        if (historyIndexRef.current < historyRef.current.length - 1) historyRef.current.splice(historyIndexRef.current + 1);
                        historyRef.current.push(normalized);
                        historyIndexRef.current = historyRef.current.length - 1;
                        lastRecordedRef.current = normalized;
                        setHistoryState({ index: historyIndexRef.current, length: historyRef.current.length });
                    }
                } else {
                    editor.chain().focus().insertContentAt({ from, to }, normalized).run();
                }
                toast.success("✨ AI Refinement applied!");
            } else {
                toast.error("AI couldn't process the refinement.");
            }
        } catch {
            toast.error("Connection interrupted.");
        } finally {
            setIsRefining(false);
        }
    };

    if (!editor) return null;

    const handleUndo = () => {
        if (historyIndexRef.current <= 0) return;
        const nextIndex = historyIndexRef.current - 1;
        const snapshot = historyRef.current[nextIndex];
        isApplyingHistoryRef.current = true;
        editor.commands.setContent(snapshot);
        isApplyingHistoryRef.current = false;
        historyIndexRef.current = nextIndex;
        lastRecordedRef.current = snapshot;
        onChange(snapshot);
        setHistoryState({ index: nextIndex, length: historyRef.current.length });
    };

    const handleRedo = () => {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        const nextIndex = historyIndexRef.current + 1;
        const snapshot = historyRef.current[nextIndex];
        isApplyingHistoryRef.current = true;
        editor.commands.setContent(snapshot);
        isApplyingHistoryRef.current = false;
        historyIndexRef.current = nextIndex;
        lastRecordedRef.current = snapshot;
        onChange(snapshot);
        setHistoryState({ index: nextIndex, length: historyRef.current.length });
    };

    const toggleLink = () => {
        const previousUrl = editor.getAttributes("link").href;
        const url = window.prompt("Enter URL:", previousUrl);
        if (url === null) return;
        if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    };

    const getLiveContent = () => {
        if (!isLivePreview || !sampleData) return content;
        let processed = content;
        const now = new Date();
        const onboardDate = sampleData.clientAddedOn ? new Date(sampleData.clientAddedOn) : null;
        const variables: Record<string, string> = {
            greeting: getSmartGreeting(sampleData.contactPerson || sampleData.poc, { email: sampleData.email }),
            firstName: getFirstName(sampleData.contactPerson || sampleData.poc) || "there",
            lastName: getLastName(sampleData.contactPerson || sampleData.poc) || "",
            fullName: sampleData.contactPerson || sampleData.poc || "Valued Partner",
            companyName: sampleData.clientName || "your organization",
            industry: sampleData.industry || "your industry",
            services: sampleData.invoiceServiceNames || "your current offering",
            location: sampleData.address || "your team",
            relationship: sampleData.relationshipLevel || "our partnership",
            tenureYears: onboardDate ? String(now.getFullYear() - onboardDate.getFullYear()) : "0",
            currentDate: now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        };
        Object.entries(variables).forEach(([key, val]) => {
            processed = processed.replace(new RegExp(`\\{\\{${key}\\}\\}`, "gi"),
                `<span class="bg-blue-50 text-blue-700 px-1 rounded font-bold border border-blue-200">${val}</span>`);
        });
        return processed;
    };

    const magicPenCategories = [
        {
            title: "✍️ Tone & Voice",
            items: [
                { label: "Make Professional", cmd: "Rewrite to be more formal and executive. Use polished business language." },
                { label: "Make Persuasive", cmd: "Add a subtle strategic push for action using social proof, urgency, and value highlight." },
                { label: "Make Friendly & Warm", cmd: "Rewrite in a warm, approachable tone while maintaining professionalism." },
                { label: "Make Confident & Bold", cmd: "Rewrite with strong, authoritative language without being arrogant." },
            ],
        },
        {
            title: "📐 Structure & Length",
            items: [
                { label: "Shorten & Punchy", cmd: "Drastically shorten into 1-2 impactful sentences. Keep only the critical point." },
                { label: "Expand with Details", cmd: "Expand with more context and examples while maintaining the core message." },
                { label: "Add Bullet Points", cmd: "Restructure into clean bullet points for easier scanning." },
                { label: "Format as Paragraphs", cmd: "Convert lists into well-structured flowing paragraphs with smooth transitions." },
            ],
        },
        {
            title: "🎯 Content Enhancement",
            items: [
                { label: "Fix Grammar & Spelling", cmd: "Fix all grammar, spelling, and punctuation errors. Do NOT change the meaning." },
                { label: "Add Social Proof", cmd: "Weave in subtle social proof like industry trends or credibility signals." },
                { label: "Strengthen the CTA", cmd: "Make the call-to-action stronger and more compelling. Create urgency without being pushy." },
                { label: "Add a P.S. Line", cmd: "Add a compelling P.S. line that reinforces the key benefit." },
            ],
        },
        {
            title: "🔄 Full Email Operations",
            fullBody: true,
            items: [
                { label: "Rewrite Entire Email", cmd: "Completely rewrite this email to be more engaging and professional while preserving all {{variable}} placeholders." },
                { label: "Improve Flow & Readability", cmd: "Improve overall flow, transitions, and readability. Make it effortless to read." },
                { label: "Make More Concise", cmd: "Cut the email length by 40% while keeping the strongest points and all {{variable}} placeholders." },
                { label: "Add Emotional Hook", cmd: "Add an emotional opening hook and compelling closing. Preserve all {{variable}} placeholders." },
            ],
        },
    ];

    const currentFontSize = editor.getAttributes("textStyle").fontSize || prefFontSize || "14px";
    const currentFontFamily = editor.getAttributes("textStyle").fontFamily || prefFontFamily || "Calibri, sans-serif";

    return (
        <div className="w-full border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xl ring-1 ring-slate-200/50">

            {/* ── Row 1: Formatting toolbar ── */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-100 bg-white flex-wrap">

                {/* Font Family */}
                <select
                    value={currentFontFamily}
                    onChange={e => {
                        const val = e.target.value;
                        editor.chain().focus().selectAll().run();
                        editor.chain().focus().setFontFamily(val).run();
                        editor.commands.focus("end");
                        setPrefFontFamily(val);
                        writeEditorPrefs({ fontFamily: val });
                    }}
                    className="h-7 text-[11px] font-medium text-slate-700 border border-slate-200 rounded-lg px-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer max-w-[110px]"
                    title="Font Family"
                >
                    {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>

                {/* Font Size */}
                <select
                    value={currentFontSize}
                    onChange={e => {
                        const val = e.target.value;
                        editor.chain().focus().selectAll().run();
                        (editor.chain().focus() as any).setFontSize(val).run();
                        editor.commands.focus("end");
                        setPrefFontSize(val);
                        writeEditorPrefs({ fontSize: val });
                    }}
                    className="h-7 text-[11px] font-medium text-slate-700 border border-slate-200 rounded-lg px-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer w-[58px]"
                    title="Font Size"
                >
                    {FONT_SIZES.map(s => <option key={s} value={s}>{s.replace("px", "")}</option>)}
                </select>

                <Divider />

                {/* Bold / Italic / Underline / Strikethrough */}
                <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)">
                    <Bold className="w-3.5 h-3.5" />
                </Btn>
                <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)">
                    <Italic className="w-3.5 h-3.5" />
                </Btn>
                <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline (Ctrl+U)">
                    <UnderlineIcon className="w-3.5 h-3.5" />
                </Btn>
                <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
                    <Strikethrough className="w-3.5 h-3.5" />
                </Btn>

                <Divider />

                {/* Text Color */}
                <div className="relative" title="Text Color">
                    <label className="flex flex-col items-center justify-center w-7 h-7 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors group">
                        <span className="text-[10px] font-black text-slate-600 leading-none" style={{ color: editor.getAttributes("textStyle").color || "#334155" }}>A</span>
                        <div className="w-4 h-1 rounded-full mt-0.5" style={{ backgroundColor: editor.getAttributes("textStyle").color || "#334155" }} />
                        <input
                            type="color"
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            value={editor.getAttributes("textStyle").color || "#334155"}
                            onChange={e => editor.chain().focus().setColor(e.target.value).run()}
                        />
                    </label>
                </div>

                {/* Highlight Color */}
                <div className="relative" title="Highlight Color">
                    <label className="flex flex-col items-center justify-center w-7 h-7 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                        <Highlighter className="w-3.5 h-3.5 text-slate-600" style={{ color: editor.getAttributes("highlight").color || "#fbbf24" }} />
                        <div className="w-4 h-1 rounded-full mt-0.5" style={{ backgroundColor: editor.getAttributes("highlight").color || "#fbbf24" }} />
                        <input
                            type="color"
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            value={editor.getAttributes("highlight").color || "#fef08a"}
                            onChange={e => (editor.chain().focus() as any).setHighlight({ color: e.target.value }).run()}
                        />
                    </label>
                </div>

                <Divider />

                {/* Alignment */}
                <Btn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align Left">
                    <AlignLeft className="w-3.5 h-3.5" />
                </Btn>
                <Btn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align Center">
                    <AlignCenter className="w-3.5 h-3.5" />
                </Btn>
                <Btn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align Right">
                    <AlignRight className="w-3.5 h-3.5" />
                </Btn>
                <Btn onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justify">
                    <AlignJustify className="w-3.5 h-3.5" />
                </Btn>

                <Divider />

                {/* Lists */}
                <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
                    <List className="w-3.5 h-3.5" />
                </Btn>
                <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered List">
                    <ListOrdered className="w-3.5 h-3.5" />
                </Btn>

                {/* Blockquote */}
                <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
                    <Quote className="w-3.5 h-3.5" />
                </Btn>

                <Divider />

                {/* Indent / Outdent */}
                <Btn onClick={() => editor.chain().focus().sinkListItem("listItem").run()} title="Indent">
                    <Indent className="w-3.5 h-3.5" />
                </Btn>
                <Btn onClick={() => editor.chain().focus().liftListItem("listItem").run()} title="Outdent">
                    <Outdent className="w-3.5 h-3.5" />
                </Btn>

                <Divider />

                {/* Link */}
                <Btn onClick={toggleLink} active={editor.isActive("link")} title="Insert Link">
                    <LinkIcon className="w-3.5 h-3.5" />
                </Btn>

                {/* Clear Formatting */}
                <Btn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear Formatting">
                    <Eraser className="w-3.5 h-3.5" />
                </Btn>
            </div>

            {/* ── Row 2: AI & Actions bar ── */}
            <div className="flex items-center justify-between gap-1 px-2 py-1 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-1">

                    {/* AI Improve */}
                    <div className="relative">
                        <button
                            onClick={() => setShowMagicMenu(!showMagicMenu)}
                            disabled={isRefining}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                                isRefining ? "bg-indigo-600 text-white animate-pulse" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white"
                            )}
                        >
                            {isRefining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            Improve
                        </button>

                        {showMagicMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowMagicMenu(false)} />
                                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-1.5 animate-in fade-in slide-in-from-top-1 max-h-[65vh] overflow-y-auto">
                                    <div className="px-3 py-2 mb-1 bg-indigo-50 rounded-xl border border-indigo-100">
                                        <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.1em]">
                                            {editor.state.selection.from !== editor.state.selection.to ? "Selection detected" : "Full body mode"}
                                        </p>
                                    </div>
                                    {magicPenCategories.map((cat, idx) => (
                                        <div key={cat.title}>
                                            {idx > 0 && <div className="border-t border-slate-100 my-1" />}
                                            <p className="text-[9px] font-black text-slate-400 px-3 pt-2 pb-1 uppercase tracking-tighter">{cat.title}</p>
                                            {cat.items.map(opt => (
                                                <button
                                                    key={opt.label}
                                                    onClick={() => handleRefine(opt.cmd, !!cat.fullBody)}
                                                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-indigo-50 text-[11px] font-bold text-slate-700 hover:text-indigo-700 transition-all flex items-center gap-2 group"
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-500 transition-colors shrink-0" />
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Insert Variable */}
                    <div className="relative">
                        <button
                            onClick={() => setShowVarMenu(!showVarMenu)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white transition-all"
                        >
                            <Variable className="w-3 h-3" />
                            Add Data
                        </button>
                        {showVarMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowVarMenu(false)} />
                                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-1.5 animate-in fade-in slide-in-from-top-1">
                                    {["greeting", "firstName", "lastName", "fullName", "companyName", "industry", "services", "location", "relationship"].map(v => (
                                        <button
                                            key={v}
                                            onClick={() => { editor.chain().focus().insertContent(`{{${v}}}`).run(); setShowVarMenu(false); }}
                                            className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-blue-50 text-[11px] font-bold text-slate-700 hover:text-blue-700 transition-colors"
                                        >
                                            {v === "greeting" ? "Smart Greeting" : v.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Live Preview */}
                    <button
                        onClick={() => setIsLivePreview(!isLivePreview)}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                            isLivePreview ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                        )}
                    >
                        {isLivePreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        Live Data
                    </button>
                </div>

                {/* Undo / Redo */}
                <div className="flex items-center gap-0.5">
                    <Btn onClick={handleUndo} disabled={historyState.index <= 0} title="Undo (Ctrl+Z)">
                        <RotateCcw className="w-3.5 h-3.5" />
                    </Btn>
                    <Btn onClick={handleRedo} disabled={historyState.index >= historyState.length - 1} title="Redo (Ctrl+Y)">
                        <RotateCw className="w-3.5 h-3.5" />
                    </Btn>
                </div>
            </div>

            {/* ── Editor area ── */}
            <div className="bg-white relative">
                {isLivePreview ? (
                    <div
                        className="prose prose-sm max-w-none min-h-[360px] px-8 py-6 text-slate-800 bg-slate-50/30 cursor-not-allowed"
                        dangerouslySetInnerHTML={{ __html: getLiveContent() }}
                    />
                ) : (
                    <EditorContent editor={editor} />
                )}

                {!content && placeholder && !isLivePreview && (
                    <div className="absolute top-6 left-10 pointer-events-none text-slate-300 font-medium italic text-sm">
                        {placeholder}
                    </div>
                )}

                {isLivePreview && (
                    <div className="absolute top-3 right-4 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-200 shadow-sm animate-pulse">
                        Previewing Live Data
                    </div>
                )}
            </div>
        </div>
    );
}

function Btn({ onClick, active, disabled, title, children }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={cn(
                "w-7 h-7 flex items-center justify-center rounded-lg transition-all",
                active ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                disabled && "opacity-30 cursor-not-allowed"
            )}
        >
            {children}
        </button>
    );
}

function Divider() {
    return <div className="w-px h-4 bg-slate-200 mx-0.5 shrink-0" />;
}
