"use client";

/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  Check,
  Clapperboard,
  ExternalLink,
  Film,
  FolderOpen,
  Keyboard,
  Library,
  MoreVertical,
  MonitorUp,
  Play,
  RefreshCcw,
  Save,
  Square,
  Star,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { LocalMovie, LocalShot, ShotBankState, StartMovieInput, UpdateShotInput } from "@/types";

const emptyMovie: StartMovieInput = {
  title: "",
  director: "",
  year: "",
  source: "",
  watchNote: "",
};
const emptyShots: LocalShot[] = [];

const shortcutDefault = "CommandOrControl+Shift+S";

type ShotDraft = Pick<UpdateShotInput, "notes" | "recreateNotes" | "tags" | "rating">;

export function ShotBankApp() {
  const [state, setState] = useState<ShotBankState | null>(null);
  const [movieInput, setMovieInput] = useState<StartMovieInput>(emptyMovie);
  const [shortcutInput, setShortcutInput] = useState(shortcutDefault);
  const [shotDrafts, setShotDrafts] = useState<Record<string, ShotDraft>>({});
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [openMovieMenuId, setOpenMovieMenuId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "idle" | "ok" | "warn"; message: string }>({
    tone: "idle",
    message: "Ready",
  });
  const [busy, setBusy] = useState(false);

  const bridge = typeof window !== "undefined" ? window.shotbank : undefined;

  const applyState = useCallback((nextState: ShotBankState) => {
    setState(nextState);
    setShortcutInput(nextState.config.shortcut);
    setShotDrafts((previous) => {
      const nextDrafts = { ...previous };
      for (const movie of nextState.movies) {
        for (const shot of movie.shots) {
          if (!nextDrafts[shot.id]) {
            nextDrafts[shot.id] = {
              notes: shot.notes || "",
              recreateNotes: shot.recreateNotes || "",
              tags: shot.tags || "",
              rating: shot.rating || 3,
            };
          }
        }
      }
      return nextDrafts;
    });
  }, []);

  useEffect(() => {
    const desktopBridge = bridge;
    if (!desktopBridge) return;
    let disposed = false;

    const hydrate = async () => {
      try {
        const nextState = await desktopBridge.getState();
        if (!disposed) applyState(nextState);
      } catch (error) {
        if (!disposed) {
          setStatus({ tone: "warn", message: error instanceof Error ? error.message : "Could not load ShotBank" });
        }
      }
    };

    void hydrate();
    return () => {
      disposed = true;
    };
  }, [applyState, bridge]);

  useEffect(() => {
    if (!bridge) return;
    return bridge.onShotCaptured(({ state: nextState, shot }) => {
      applyState(nextState);
      setSelectedShotId(shot.id);
      setStatus({ tone: "ok", message: `Captured ${shot.fileName}` });
    });
  }, [applyState, bridge]);

  const movieMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!openMovieMenuId) return;
    function handleClick(event: MouseEvent) {
      if (!movieMenuRef.current?.contains(event.target as Node)) {
        setOpenMovieMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMovieMenuId]);

  const activeMovie = state?.activeMovie ?? null;
  const activeShots = activeMovie?.shots ?? emptyShots;
  const selectedShot = useMemo(() => {
    if (!activeMovie) return null;
    return activeShots.find((shot) => shot.id === selectedShotId) || activeShots[0] || null;
  }, [activeMovie, activeShots, selectedShotId]);

  async function run(action: () => Promise<ShotBankState | void>, okMessage: string) {
    if (!bridge) return;
    setBusy(true);
    try {
      const nextState = await action();
      if (nextState) applyState(nextState);
      setStatus({ tone: "ok", message: okMessage });
    } catch (error) {
      setStatus({ tone: "warn", message: error instanceof Error ? error.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  }

  async function startMovie() {
    if (!bridge) return;
    if (!movieInput.title.trim()) {
      setStatus({ tone: "warn", message: "Movie title is required" });
      return;
    }
    await run(async () => bridge.startMovie(movieInput), "Session started");
    setMovieInput(emptyMovie);
  }

  async function captureNow() {
    if (!bridge) return;
    await run(async () => bridge.captureNow(), "Screenshot captured");
  }

  async function saveShot(shot: LocalShot) {
    if (!bridge) return;
    const draft = shotDrafts[shot.id];
    if (!activeMovie || !draft) return;
    await run(
      async () =>
        bridge.updateShot({
          movieId: activeMovie.id,
          shotId: shot.id,
          ...draft,
        }),
      "Shot notes saved",
    );
  }

  async function setShortcut() {
    if (!bridge) return;
    await run(async () => bridge.setShortcut(shortcutInput), "Shortcut saved");
  }

  async function deleteMovie(movie: LocalMovie) {
    if (!bridge) return;
    const confirmed = window.confirm(`Move "${movie.title}" and all its screenshots to the Recycle Bin?`);
    if (!confirmed) return;

    setOpenMovieMenuId(null);
    await run(async () => bridge.deleteMovie(movie.id), "Movie folder moved to Recycle Bin");
    if (selectedShotId && movie.shots.some((shot) => shot.id === selectedShotId)) {
      setSelectedShotId(null);
    }
  }

  if (!bridge) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#09090b] p-6 text-zinc-100">
        <div className="max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
            <MonitorUp className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-lg font-medium tracking-tight">ShotBank Desktop</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Screenshot capture and folder storage run through the installed desktop app.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#09090b] text-zinc-100">
      <TopBar state={state} status={status} activeMovie={activeMovie} onCapture={captureNow} busy={busy} />

      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          state={state}
          movieInput={movieInput}
          setMovieInput={setMovieInput}
          onStartMovie={startMovie}
          shortcutInput={shortcutInput}
          setShortcutInput={setShortcutInput}
          onSetShortcut={setShortcut}
          onChooseLibrary={() => run(async () => bridge?.chooseLibraryRoot(), "Library folder changed")}
          onOpenLibrary={() => state && bridge?.openPath(state.config.libraryRoot)}
          busy={busy}
        />

        <CenterStage
          activeMovie={activeMovie}
          selectedShot={selectedShot}
          shotDrafts={shotDrafts}
          onDraftChange={(shotId, draft) => setShotDrafts((value) => ({ ...value, [shotId]: draft }))}
          onSaveShot={saveShot}
          onEndSession={() => run(async () => bridge?.endSession(), "Session stopped")}
          onOpenMovieFolder={() => activeMovie && bridge?.openPath(activeMovie.folderPath)}
          busy={busy}
        />

        <MovieFolders
          movies={state?.movies ?? []}
          activeMovie={activeMovie}
          openMovieMenuId={openMovieMenuId}
          onToggleMenu={(movieId) => setOpenMovieMenuId((value) => (value === movieId ? null : movieId))}
          onResume={(movieId) => run(async () => bridge?.resumeMovie(movieId), "Session resumed")}
          onOpen={(folderPath) => bridge?.openPath(folderPath)}
          onDelete={deleteMovie}
          menuRef={movieMenuRef}
        />
      </div>

      <CaptureStream
        shots={activeShots}
        selectedShotId={selectedShot?.id ?? null}
        onSelect={setSelectedShotId}
      />
    </main>
  );
}

function TopBar({
  state,
  status,
  activeMovie,
  onCapture,
  busy,
}: {
  state: ShotBankState | null;
  status: { tone: "idle" | "ok" | "warn"; message: string };
  activeMovie: LocalMovie | null;
  onCapture: () => void;
  busy: boolean;
}) {
  const totalShots = state?.movies.reduce((sum, movie) => sum + movie.shots.length, 0) ?? 0;
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/60 bg-zinc-900/30 px-4">
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-amber-400">
          <Camera className="h-4 w-4" />
        </div>
        <div className="hidden sm:block">
          <h1 className="text-sm font-semibold tracking-tight">ShotBank</h1>
          <p className="text-[11px] text-zinc-500">
            {state?.movies.length ?? 0} movies / {totalShots} shots
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge status={status} />
        <Button
          onClick={onCapture}
          disabled={!activeMovie || busy}
          title={
            activeMovie
              ? `Capture the screen (${formatShortcut(state?.config.shortcut)})`
              : "Start a session to capture"
          }
          className="h-8 gap-1.5 bg-amber-500 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 active:scale-95"
        >
          <Camera className="h-4 w-4" /> Capture
        </Button>
      </div>
    </header>
  );
}

function StatusBadge({
  status,
}: {
  status: { tone: "idle" | "ok" | "warn"; message: string };
}) {
  const toneClasses = {
    warn: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    ok: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    idle: "text-zinc-400 bg-zinc-900/50 border-zinc-800",
  };
  return (
    <div
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs sm:flex",
        toneClasses[status.tone],
      )}
    >
      {status.tone === "warn" ? <AlertCircle className="h-3 w-3" /> : null}
      {status.tone === "ok" ? <Check className="h-3 w-3" /> : null}
      <span className="max-w-[180px] truncate">{status.message}</span>
    </div>
  );
}

function LeftSidebar({
  state,
  movieInput,
  setMovieInput,
  onStartMovie,
  shortcutInput,
  setShortcutInput,
  onSetShortcut,
  onChooseLibrary,
  onOpenLibrary,
  busy,
}: {
  state: ShotBankState | null;
  movieInput: StartMovieInput;
  setMovieInput: React.Dispatch<React.SetStateAction<StartMovieInput>>;
  onStartMovie: () => void;
  shortcutInput: string;
  setShortcutInput: (value: string) => void;
  onSetShortcut: () => void;
  onChooseLibrary: () => void;
  onOpenLibrary: () => void;
  busy: boolean;
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-zinc-800/60 bg-zinc-900/20 p-4">
      <section className="space-y-3">
        <SectionTitle icon={Clapperboard}>Watch Setup</SectionTitle>
        <div className="space-y-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
          <Field label="Movie">
            <Input
              value={movieInput.title}
              onChange={(event) => setMovieInput((value) => ({ ...value, title: event.target.value }))}
              placeholder="In the Mood for Love"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Director">
              <Input
                value={movieInput.director}
                onChange={(event) => setMovieInput((value) => ({ ...value, director: event.target.value }))}
                placeholder="Wong Kar-wai"
              />
            </Field>
            <Field label="Year">
              <Input
                value={movieInput.year}
                onChange={(event) => setMovieInput((value) => ({ ...value, year: event.target.value }))}
                placeholder="2000"
              />
            </Field>
          </div>
          <Field label="Source">
            <Input
              value={movieInput.source}
              onChange={(event) => setMovieInput((value) => ({ ...value, source: event.target.value }))}
              placeholder="File, stream, disc"
            />
          </Field>
          <Field label="Focus">
            <Textarea
              value={movieInput.watchNote}
              onChange={(event) => setMovieInput((value) => ({ ...value, watchNote: event.target.value }))}
              placeholder="Color, blocking, faces, rooms..."
              className="min-h-[72px] resize-none"
            />
          </Field>
          <Button onClick={onStartMovie} disabled={busy} className="w-full gap-1.5">
            <Play className="h-4 w-4" /> Start Session
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={Keyboard}>Shortcut</SectionTitle>
        <div className="space-y-2 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
          <div className="flex gap-2">
            <Input
              value={shortcutInput}
              onChange={(event) => setShortcutInput(event.target.value)}
              placeholder={shortcutDefault}
            />
            <Button variant="secondary" onClick={onSetShortcut} disabled={busy} className="shrink-0">
              Save
            </Button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>{state?.shortcutRegistered ? "Registered" : "Not registered"}</span>
            {state?.shortcutRegistered ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={Library}>Library</SectionTitle>
        <div className="space-y-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
          <div className="break-all rounded-lg bg-zinc-950 px-3 py-2 font-mono text-[11px] text-zinc-500">
            {state?.config.libraryRoot || "Loading..."}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={onChooseLibrary} disabled={busy}>
              <FolderOpen className="h-3.5 w-3.5" /> Change
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenLibrary} disabled={!state}>
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </Button>
          </div>
        </div>
      </section>
    </aside>
  );
}

function CenterStage({
  activeMovie,
  selectedShot,
  shotDrafts,
  onDraftChange,
  onSaveShot,
  onEndSession,
  onOpenMovieFolder,
  busy,
}: {
  activeMovie: LocalMovie | null;
  selectedShot: LocalShot | null;
  shotDrafts: Record<string, ShotDraft>;
  onDraftChange: (shotId: string, draft: ShotDraft) => void;
  onSaveShot: (shot: LocalShot) => void;
  onEndSession: () => void;
  onOpenMovieFolder: () => void;
  busy: boolean;
}) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-black/30">
      <ActiveSessionStrip
        movie={activeMovie}
        onEnd={onEndSession}
        onOpenFolder={onOpenMovieFolder}
        busy={busy}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ShotViewer shot={selectedShot} hasSession={!!activeMovie} />
        <ShotNotes
          movie={activeMovie}
          shot={selectedShot}
          draft={selectedShot ? shotDrafts[selectedShot.id] : null}
          onDraftChange={onDraftChange}
          onSave={onSaveShot}
          busy={busy}
        />
      </div>
    </section>
  );
}

function ActiveSessionStrip({
  movie,
  onEnd,
  onOpenFolder,
  busy,
}: {
  movie: LocalMovie | null;
  onEnd: () => void;
  onOpenFolder: () => void;
  busy: boolean;
}) {
  if (!movie) {
    return (
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800/60 bg-zinc-900/20 px-4">
        <span className="text-xs text-zinc-500">No active session</span>
        <span className="text-xs text-zinc-600">Start a movie to capture frames</span>
      </div>
    );
  }

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800/60 bg-zinc-900/20 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Badge variant="green" className="h-5 px-1.5 text-[10px]">
          Active
        </Badge>
        <h2 className="truncate text-sm font-medium text-zinc-100">{movie.title}</h2>
        <span className="hidden text-xs text-zinc-500 lg:inline">
          {[movie.director, movie.year, movie.source].filter(Boolean).join(" / ")}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={onOpenFolder}>
          <FolderOpen className="h-3.5 w-3.5" /> Folder
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-zinc-400 hover:text-zinc-100"
          onClick={onEnd}
          disabled={busy}
        >
          <Square className="h-3.5 w-3.5" /> End
        </Button>
      </div>
    </div>
  );
}

function ShotViewer({ shot, hasSession }: { shot: LocalShot | null; hasSession: boolean }) {
  if (!shot) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-zinc-500">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900/60 text-zinc-600">
          <Camera className="h-7 w-7" />
        </div>
        <p className="text-center text-sm">
          {hasSession ? "Select or capture a frame to view it here" : "Start a session to begin capturing"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-black p-4 sm:p-6">
      {shot.fileUrl ? (
        <img
          src={shot.fileUrl}
          alt=""
          className="max-h-full max-w-full rounded-md object-contain shadow-2xl"
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-zinc-900 text-zinc-600">
          <Camera className="h-8 w-8" />
        </div>
      )}
    </div>
  );
}

function ShotNotes({
  movie,
  shot,
  draft,
  onDraftChange,
  onSave,
  busy,
}: {
  movie: LocalMovie | null;
  shot: LocalShot | null;
  draft: ShotDraft | null;
  onDraftChange: (shotId: string, draft: ShotDraft) => void;
  onSave: (shot: LocalShot) => void;
  busy: boolean;
}) {
  if (!movie || !shot || !draft) return null;

  const updateDraft = (patch: Partial<ShotDraft>) => onDraftChange(shot.id, { ...draft, ...patch });

  return (
    <div className="shrink-0 border-t border-zinc-800/60 bg-zinc-900/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {formatDateTime(shot.capturedAt)}
          </div>
          <div className="truncate text-sm font-medium text-zinc-200">{shot.fileName}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => window.shotbank?.openPath(shot.filePath)}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </Button>
          <Button size="sm" onClick={() => onSave(shot)} disabled={busy} className="h-8 gap-1.5">
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="Notes">
          <Textarea
            value={draft.notes}
            onChange={(event) => updateDraft({ notes: event.target.value })}
            placeholder="What makes this frame worth saving?"
            className="min-h-[72px] resize-none"
          />
        </Field>
        <Field label="Recreate later">
          <Textarea
            value={draft.recreateNotes}
            onChange={(event) => updateDraft({ recreateNotes: event.target.value })}
            placeholder="Lighting, lens, blocking, movement..."
            className="min-h-[72px] resize-none"
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Tags" className="flex-1">
          <Input
            value={draft.tags}
            onChange={(event) => updateDraft({ tags: event.target.value })}
            placeholder="silhouette, rain, doorway"
          />
        </Field>
        <div className="flex items-center gap-0.5 pb-0.5">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              onClick={() => updateDraft({ rating })}
              className={cn(
                "p-1 transition-colors hover:text-amber-300",
                rating <= draft.rating ? "text-amber-400" : "text-zinc-600",
              )}
              aria-label={`Rate ${rating}`}
              aria-pressed={rating <= draft.rating}
              title={`${rating} star${rating > 1 ? "s" : ""}`}
            >
              <Star className={cn("h-5 w-5", rating <= draft.rating ? "fill-amber-400" : "")} />
            </button>
          ))}
        </div>
      </div>

      {draft.tags && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {draft.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
            .map((tag) => (
              <Badge key={tag} variant="outline" className="text-[11px]">
                {tag}
              </Badge>
            ))}
        </div>
      )}
    </div>
  );
}

function MovieFolders({
  movies,
  activeMovie,
  openMovieMenuId,
  onToggleMenu,
  onResume,
  onOpen,
  onDelete,
  menuRef,
}: {
  movies: LocalMovie[];
  activeMovie: LocalMovie | null;
  openMovieMenuId: string | null;
  onToggleMenu: (movieId: string) => void;
  onResume: (movieId: string) => void;
  onOpen: (folderPath: string) => void;
  onDelete: (movie: LocalMovie) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-l border-zinc-800/60 bg-zinc-900/20">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-800/60 px-4 text-xs font-medium uppercase tracking-wider text-zinc-400">
        <Film className="h-3.5 w-3.5" /> Movie Folders
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {movies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
            No movie folders yet.
          </div>
        ) : (
          <div className="space-y-2">
            {movies.map((movie) => (
              <MovieRow
                key={movie.id}
                movie={movie}
                active={movie.id === activeMovie?.id}
                onResume={() => onResume(movie.id)}
                onOpen={() => onOpen(movie.folderPath)}
                menuOpen={openMovieMenuId === movie.id}
                onToggleMenu={() => onToggleMenu(movie.id)}
                onDelete={() => onDelete(movie)}
                menuRef={openMovieMenuId === movie.id ? menuRef : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function MovieRow({
  movie,
  active,
  onResume,
  onOpen,
  menuOpen,
  onToggleMenu,
  onDelete,
  menuRef,
}: {
  movie: LocalMovie;
  active: boolean;
  onResume: () => void;
  onOpen: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onDelete: () => void;
  menuRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={menuRef}
      className={cn(
        "relative rounded-lg border p-2.5 transition",
        active ? "border-emerald-500/20 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-200">{movie.title}</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            {movie.shots.length} shots / {formatDate(movie.updatedAt)}
          </div>
        </div>
        {active ? <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> : null}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Button variant="secondary" size="sm" className="h-7 flex-1 gap-1 text-xs" onClick={onResume}>
          <RefreshCcw className="h-3 w-3" /> Resume
        </Button>
        <Button variant="outline" size="sm" className="h-7 flex-1 gap-1 text-xs" onClick={onOpen}>
          <FolderOpen className="h-3 w-3" /> Folder
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
          onClick={onToggleMenu}
          aria-label={`More options for ${movie.title}`}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </div>
      {menuOpen && (
        <div className="absolute right-2 top-[calc(100%-0.25rem)] z-10 w-40 rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
          <button
            type="button"
            onClick={onDelete}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-zinc-400 hover:bg-zinc-900 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete folder
          </button>
        </div>
      )}
    </div>
  );
}

function CaptureStream({
  shots,
  selectedShotId,
  onSelect,
}: {
  shots: LocalShot[];
  selectedShotId: string | null;
  onSelect: (shotId: string) => void;
}) {
  return (
    <div className="flex h-36 shrink-0 flex-col border-t border-zinc-800/60 bg-zinc-900/30">
      <div className="flex h-9 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
          <Film className="h-3.5 w-3.5" /> Capture Stream
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {shots.length}
        </Badge>
      </div>
      {shots.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-zinc-600">
          Screenshots appear here as you capture.
        </div>
      ) : (
        <div className="flex flex-1 gap-2 overflow-x-auto px-4 pb-3">
          {shots.map((shot) => (
            <button
              key={shot.id}
              onClick={() => onSelect(shot.id)}
              className={cn(
                "group relative shrink-0 overflow-hidden rounded-lg border-2 text-left transition",
                selectedShotId === shot.id ? "border-amber-500" : "border-transparent hover:border-zinc-600",
              )}
            >
              <div className="h-20 w-36 bg-black">
                {shot.fileUrl ? (
                  <img src={shot.fileUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
                <div className="text-[10px] tabular-nums text-zinc-300">{formatTime(shot.capturedAt)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Camera; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</Label>
      {children}
    </div>
  );
}

function formatShortcut(value?: string) {
  if (!value) return shortcutDefault;
  return value.replace(/CommandOrControl/gi, "Ctrl").replace(/\+/g, " + ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
