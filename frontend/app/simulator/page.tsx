"use client";

import { useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Play, Lightbulb, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProblemPanel, type Problem } from "@/components/simulator/ProblemPanel";
import { CodeEditor } from "@/components/simulator/Editor";
import { AuthGate } from "@/components/auth/AuthGate";
import axios from "axios";
import { toast } from "sonner"; // Assuming sonner or use toast from ui/use-toast

// Temporary mock problem
// Initial empty problem state or null
const INITIAL_PROBLEM: Problem | null = null;




export default function SimulatorPage() {
    const [problem, setProblem] = useState<Problem | null>(null);
    const [code, setCode] = useState("");
    const [output, setOutput] = useState<string>("");
    const [isRunning, setIsRunning] = useState(false);
    const [topic, setTopic] = useState("Arrays");
    const [difficulty, setDifficulty] = useState("Easy");
    const [isGenerating, setIsGenerating] = useState(false);

    const generateProblem = async () => {
        setIsGenerating(true);
        try {
            const res = await axios.post("http://127.0.0.1:8000/simulator/generate", {
                topic,
                difficulty
            });
            const newProblem = res.data;
            setProblem(newProblem);
            setCode(newProblem.initial_code);
            setOutput("");
        } catch (e: any) {
            toast.error("Failed to generate problem: " + e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const runCode = async () => {
        if (!problem) return;
        setIsRunning(true);
        setOutput("Running...");
        try {
            // Serialize test cases from the current problem
            // problem.test_cases is Array of {input: object, output: any}
            // we need to pass this as a JSON string to the python script or reconstruct it there.
            // Simplified approach: Serialize inputs/outputs to a python string literal

            const testCasesJson = JSON.stringify(problem.test_cases?.map(tc => [tc.input, tc.output]) || []);

            const testRunner = `
if __name__ == "__main__":
    import json
    from typing import List, Dict, Any, Optional

    try:
        sol = Solution()
        # Load test cases
        raw_cases = json.loads('${testCasesJson}')
        # raw_cases is list of [input_dict, expected_output]
        
        passed_count = 0
        total_count = len(raw_cases)

        for i, (input_args, expected) in enumerate(raw_cases):
            print(f"Test Case {i + 1}:")
            print(f"Input: {input_args}")
            try:
                # Assuming input_args is a dict of kwargs
                # result = sol.twoSum(**input_args) # FIXME: Method name needs to be dynamic or standard!
                # For now let's try to find the method dynamically or standardise on 'solve'
                # Or we parse the method name from the initial code? 
                # Let's inspect 'sol' to find the method that isn't magic?
                
                # Better approach for MVP: Use the method name returned by AI or hardcode 'solve' in AI prompt.
                # Let's assume the user uses the provided method signature. 
                # We can inspect the class for public methods.
                
                methods = [m for m in dir(sol) if callable(getattr(sol, m)) and not m.startswith("__")]
                if not methods:
                   print("Error: No method found in Solution class")
                   continue
                method_name = methods[0] # Pick first public method
                method = getattr(sol, method_name)
                
                result = method(*input_args.values())
                
                print(f"Result: {result}")
                
                # Simple equality check
                if result == expected: # This might fail for lists with different order if order doesn't matter
                    print("Status: PASSED")
                    passed_count += 1
                else:
                     # Attempt sorted check for lists
                    if isinstance(result, list) and isinstance(expected, list):
                        try:
                            if sorted(result) == sorted(expected):
                                print("Status: PASSED")
                                passed_count += 1
                            else:
                                print(f"Status: FAILED (Expected {expected})")
                        except:
                             print(f"Status: FAILED (Expected {expected})")
                    else:
                        print(f"Status: FAILED (Expected {expected})")
                        
            except Exception as e:
                print(f"Error: {e}")
            print("-" * 20)
        
        print(f"Summary: {passed_count}/{total_count} Passed")

    except Exception as e:
        print(f"Runtime Error: {e}")
`;

            const fullCode = "from typing import List, Dict, Any, Optional\n" + code + "\n" + testRunner;

            const res = await axios.post("https://emkc.org/api/v2/piston/execute", {
                language: "python",
                version: "3.10.0",
                files: [{ content: fullCode }]
            });
            const run = res.data.run;
            if (run.stdout || run.stderr) {
                setOutput((run.stdout || "") + (run.stderr ? `\nError:\n${run.stderr}` : ""));
            } else {
                setOutput("No output returned.");
            }

        } catch (err: any) {
            setOutput(`Execution failed: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <AuthGate>
            <div className="flex flex-col md:flex-row overflow-hidden">
                <ResizablePanelGroup direction="horizontal">
                    {/* Left Panel: Problem */}
                    <ResizablePanel defaultSize={40} minSize={30}>
                        {problem ? (
                            <ProblemPanel problem={problem} />
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center p-6 bg-muted/20">
                                <Card className="w-full max-w-md shadow-lg border-2">
                                    <CardHeader className="text-center pb-2">
                                        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
                                            <Lightbulb className="h-6 w-6 text-primary" />
                                        </div>
                                        <CardTitle className="text-2xl">AI Problem Generator</CardTitle>
                                        <CardDescription>
                                            Choose a topic and difficulty to generate a unique coding challenge.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="topic">Topic</Label>
                                            <Input
                                                id="topic"
                                                placeholder="e.g. Recursion, Dynamic Programming"
                                                value={topic}
                                                onChange={(e) => setTopic(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="difficulty">Difficulty</Label>
                                            <Select value={difficulty} onValueChange={setDifficulty}>
                                                <SelectTrigger id="difficulty">
                                                    <SelectValue placeholder="Select difficulty" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Easy">Easy</SelectItem>
                                                    <SelectItem value="Medium">Medium</SelectItem>
                                                    <SelectItem value="Hard">Hard</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button
                                            className="w-full mt-4"
                                            size="lg"
                                            onClick={generateProblem}
                                            disabled={isGenerating}
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="mr-2 h-4 w-4" />
                                                    Generate Challenge
                                                </>
                                            )}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </ResizablePanel>

                    <ResizableHandle />

                    {/* Right Panel: Editor & Console */}
                    <ResizablePanel defaultSize={60}>
                        <ResizablePanelGroup direction="vertical">
                            {/* Editor Area */}
                            <ResizablePanel defaultSize={70} className="min-h-[300px]">
                                <div className="h-full flex flex-col bg-background">
                                    <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40 backdrop-blur">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full dark:bg-blue-900/30 dark:text-blue-400">
                                                PYTHON 3.10
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-foreground">
                                                <Lightbulb className="h-3.5 w-3.5" />
                                                Hint
                                            </Button>
                                            <Button size="sm" className="h-8 gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={runCode} disabled={isRunning}>
                                                {isRunning ? (
                                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                ) : (
                                                    <Play className="h-3.5 w-3.5 fill-current" />
                                                )}
                                                Run Code
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex-1 relative">
                                        <CodeEditor
                                            language="python"
                                            code={code}
                                            onChange={(val) => setCode(val || "")}
                                        />
                                    </div>
                                </div>
                            </ResizablePanel>

                            <ResizableHandle />

                            {/* Console Area */}
                            <ResizablePanel defaultSize={30} minSize={10}>
                                <div className="h-full flex flex-col bg-[#1e1e1e] text-slate-300 border-t border-slate-800">
                                    <div className="flex items-center px-4 py-1.5 bg-[#252526] border-b border-black/20 select-none">
                                        <span className="text-xs font-mono uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                            <Terminal className="h-3 w-3" />
                                            Console Output
                                        </span>
                                    </div>
                                    <div className="p-4 font-mono text-sm whitespace-pre-wrap overflow-auto flex-1 leading-relaxed custom-scrollbar">
                                        {output ? (
                                            output
                                        ) : (
                                            <span className="text-slate-600 italic opacity-50">
                                                // Output will appear here...
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </AuthGate>
    );
}
