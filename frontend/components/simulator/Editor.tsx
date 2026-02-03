"use client";

import Editor, { OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

interface CodeEditorProps {
    language: string;
    code: string;
    onChange: (value: string | undefined) => void;
}

export function CodeEditor({ language, code, onChange }: CodeEditorProps) {
    const { theme } = useTheme();
    const editorRef = useRef<any>(null);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
    };

    return (
        <div className="h-full w-full">
            <Editor
                height="100%"
                language={language}
                value={code}
                theme={theme === "dark" ? "vs-dark" : "light"}
                onChange={onChange}
                onMount={handleEditorDidMount}
                options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    readOnly: false,
                    automaticLayout: true,
                }}
            />
        </div>
    );
}
