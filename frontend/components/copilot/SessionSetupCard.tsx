"use client";

import { SKILLS_BY_TRACK } from "@/types/copilot";
import type { Level, Mode, QuestionType, Skill, Track } from "@/types/copilot";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  mode: Mode;
  setMode: (v: Mode) => void;

  track: Track;
  setTrack: (v: Track) => void;

  level: Level;
  setLevel: (v: Level) => void;

  skill: Skill;
  setSkill: (v: Skill) => void;

  topic: string;
  setTopic: (v: string) => void;

  questionType: QuestionType;
  setQuestionType: (v: QuestionType) => void;

  difficulty: number;
  setDifficulty: (v: number) => void;

  sessionId: number | null;

  loading: string | null;
  error: string | null;

  onCreateSession: () => void;
  onGenerateQuestion: () => void;

  canGenerateQuestion: boolean;
};

export function SessionSetupCard({
  mode,
  setMode,
  track,
  setTrack,
  level,
  setLevel,
  skill,
  setSkill,
  topic,
  setTopic,
  questionType,
  setQuestionType,
  difficulty,
  setDifficulty,
  sessionId,
  loading,
  error,
  onCreateSession,
  onGenerateQuestion,
  canGenerateQuestion,
}: Props) {
  const isBusy = !!loading;

  const allowedSkills = SKILLS_BY_TRACK[track];

  const topicPlaceholder =
    track === "backend"
      ? "e.g., joins, indexes, caching"
      : track === "frontend"
        ? "e.g., hooks, rendering, performance"
        : "e.g., auth, caching, hydration";

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Session setup</CardTitle>
              <Badge variant="outline" className="text-xs">
                Configure
              </Badge>
            </div>
            <CardDescription>
              Pick your track, level, and focus area. Then create a session and generate a question.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-xs text-slate-500">Session</div>
              <div className="mt-1">
                {sessionId ? (
                  <Badge variant="secondary" className="font-mono">
                    #{sessionId}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="font-mono">
                    —
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="mode">Mode</Label>
              <span className="text-xs text-slate-500">Learn vs. Interview</span>
            </div>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)} disabled={isBusy}>
              <SelectTrigger id="mode">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="learn">learn</SelectItem>
                <SelectItem value="interview">interview</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="track">Track</Label>
              <span className="text-xs text-slate-500">What role?</span>
            </div>
            <Select value={track} onValueChange={(v) => setTrack(v as Track)} disabled={isBusy}>
              <SelectTrigger id="track">
                <SelectValue placeholder="Select track" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backend">backend</SelectItem>
                <SelectItem value="frontend">frontend</SelectItem>
                <SelectItem value="fullstack">fullstack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="level">Level</Label>
              <span className="text-xs text-slate-500">Your current stage</span>
            </div>
            <Select value={level} onValueChange={(v) => setLevel(v as Level)} disabled={isBusy}>
              <SelectTrigger id="level">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">beginner</SelectItem>
                <SelectItem value="intermediate">intermediate</SelectItem>
                <SelectItem value="advanced">advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="skill">Skill</Label>
              <span className="text-xs text-slate-500">Pick a category</span>
            </div>
            <Select value={skill} onValueChange={(v) => setSkill(v as Skill)} disabled={isBusy}>
              <SelectTrigger id="skill">
                <SelectValue placeholder="Select skill" />
              </SelectTrigger>
              <SelectContent>
                {allowedSkills.map((sk) => (
                  <SelectItem key={sk} value={sk}>
                    {sk}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="qtype">Question type</Label>
              <span className="text-xs text-slate-500">Style of prompt</span>
            </div>
            <Select
              value={questionType}
              onValueChange={(v) => setQuestionType(v as QuestionType)}
              disabled={isBusy}
            >
              <SelectTrigger id="qtype">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conceptual">conceptual</SelectItem>
                <SelectItem value="scenario">scenario</SelectItem>
                <SelectItem value="problem">problem</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="topic">Topic</Label>
              <span className="text-xs text-slate-500">Optional</span>
            </div>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={topicPlaceholder}
              disabled={isBusy}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor="difficulty">Difficulty</Label>
            <span className="text-xs text-slate-500">1 = easy, 5 = hard</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={difficulty === d ? "default" : "outline"}
                  onClick={() => setDifficulty(d)}
                  disabled={isBusy}
                  className="w-10"
                >
                  {d}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">or</span>
              <Input
                id="difficulty"
                type="number"
                inputMode="numeric"
                min={1}
                max={5}
                value={difficulty}
                onChange={(e) => {
                  const n = parseInt(e.target.value || "3", 10);
                  const clamped = Number.isFinite(n)
                    ? Math.min(5, Math.max(1, n))
                    : 3;
                  setDifficulty(clamped);
                }}
                disabled={isBusy}
                className="w-24"
              />
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {loading}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
            {error}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button onClick={onCreateSession} disabled={isBusy}>
            Create session
          </Button>
          <Button
            variant="secondary"
            onClick={onGenerateQuestion}
            disabled={!canGenerateQuestion || isBusy}
          >
            Generate question
          </Button>
        </div>

        <div className="text-xs text-slate-500">
          Best practice: create a session once, then generate multiple questions.
        </div>
      </CardFooter>
    </Card>
  );
}
