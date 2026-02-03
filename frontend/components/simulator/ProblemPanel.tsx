import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface Problem {
    id: string;
    title: string;
    difficulty: "Easy" | "Medium" | "Hard";
    description: string;
    examples: { input: any; output: any; explanation?: string }[];
    constraints: string[];
    initial_code?: string;
    test_cases?: { input: any; output: any }[];
    solution?: string;
    hints?: string[];
};

const formatValue = (val: any) => {
    if (typeof val === 'object' && val !== null) {
        return JSON.stringify(val);
    }
    return String(val);
};

export function ProblemPanel({ problem }: { problem: Problem }) {
    return (
        <Card className="h-full border-none shadow-none rounded-none overflow-y-auto">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{problem.title}</CardTitle>
                    <Badge
                        variant={
                            problem.difficulty === "Easy"
                                ? "secondary"
                                : problem.difficulty === "Medium"
                                    ? "default"
                                    : "destructive"
                        }
                    >
                        {problem.difficulty}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="prose prose-sm dark:prose-invert">
                    <p className="whitespace-pre-wrap">{problem.description}</p>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Examples</h3>
                    {problem.examples.map((ex, i) => (
                        <div key={i} className="bg-muted/50 p-3 rounded-md text-sm space-y-2">
                            <div>
                                <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground block">
                                    Input
                                </span>
                                <code className="font-mono">{formatValue(ex.input)}</code>
                            </div>
                            <div>
                                <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground block">
                                    Output
                                </span>
                                <code className="font-mono">{formatValue(ex.output)}</code>
                            </div>
                            {ex.explanation && (
                                <div>
                                    <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground block">
                                        Explanation
                                    </span>
                                    <div className="text-muted-foreground">{ex.explanation}</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {problem.constraints && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold">Constraints</h3>
                        <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
                            {problem.constraints.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
