export interface LocalShot {
  id: string;
  fileName: string;
  filePath: string;
  fileUrl: string | null;
  relativePath: string;
  capturedAt: string;
  trigger: "manual" | "shortcut" | string;
  notes: string;
  recreateNotes: string;
  tags: string;
  rating: number;
  exists?: boolean;
  updatedAt?: string;
}

export interface LocalMovie {
  id: string;
  title: string;
  director: string;
  year: string;
  source: string;
  watchNote: string;
  folderPath: string;
  shotsPath: string;
  createdAt: string;
  updatedAt: string;
  shots: LocalShot[];
}

export interface LocalConfig {
  libraryRoot: string;
  shortcut: string;
  activeMovieId: string | null;
  lastCaptureAt: string | null;
}

export interface ShotBankState {
  config: LocalConfig;
  movies: LocalMovie[];
  activeMovie: LocalMovie | null;
  shortcutRegistered: boolean;
  isDesktop: boolean;
}

export interface StartMovieInput {
  title: string;
  director?: string;
  year?: string;
  source?: string;
  watchNote?: string;
}

export interface UpdateShotInput {
  movieId: string;
  shotId: string;
  notes: string;
  recreateNotes: string;
  tags: string;
  rating: number;
}

export interface UpdateMovieInput {
  movieId: string;
  title: string;
  director: string;
  year: string;
  source: string;
  watchNote: string;
}

export interface ShotCapturedPayload {
  shot: LocalShot;
  state: ShotBankState;
}

export interface ShotBankBridge {
  getState(): Promise<ShotBankState>;
  startMovie(input: StartMovieInput): Promise<ShotBankState>;
  resumeMovie(movieId: string): Promise<ShotBankState>;
  deleteMovie(movieId: string): Promise<ShotBankState>;
  endSession(): Promise<ShotBankState>;
  captureNow(): Promise<ShotBankState>;
  updateShot(input: UpdateShotInput): Promise<ShotBankState>;
  updateMovie(input: UpdateMovieInput): Promise<ShotBankState>;
  setShortcut(accelerator: string): Promise<ShotBankState>;
  chooseLibraryRoot(): Promise<ShotBankState>;
  openPath(targetPath: string): Promise<void>;
  onShotCaptured(callback: (payload: ShotCapturedPayload) => void): () => void;
}
